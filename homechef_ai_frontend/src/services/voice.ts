import api from './api'

type ImportMetaEnvSafe = {
  VITE_FEATURE_FLAGS?: string
  VITE_EXPERIMENTS_ENABLED?: string
}
type ImportMetaSafe = {
  env?: ImportMetaEnvSafe
}

/**
 * Utility: parse feature flags from env into a set.
 */
function parseFeatureFlags(raw?: string): Set<string> {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

/**
 * Get feature flag state from environment and (placeholder) app store.
 * For now we only read from env; if an app store exists later, wire it here.
 */
function getFeatureFlags() {
  const meta = (import.meta as unknown as ImportMetaSafe) || {}
  const env = meta.env || {}
  const flags = parseFeatureFlags(env.VITE_FEATURE_FLAGS)

  // Back-compat experiment toggle: treat truthy as enabling voice as experiment if no explicit flag provided
  const experimentsEnabled = String(env.VITE_EXPERIMENTS_ENABLED ?? '').toLowerCase()
  const experimentsOn = experimentsEnabled === '1' || experimentsEnabled === 'true' || experimentsEnabled === 'yes'

  // Voice feature enabled when "voice" flag present OR when experiments are on and no explicit flag disables it
  const voiceEnabled = flags.has('voice') || (experimentsOn && !flags.has('voice_off'))
  // Speech API usage can be gated separately if needed, default allow when voice is enabled.
  const sttEnabled = voiceEnabled && (!flags.has('stt_off'))
  // Server transcription fallback
  const serverTranscribeEnabled = voiceEnabled && (flags.has('voice_server') || flags.has('voice_fallback_server'))

  return {
    flags,
    voiceEnabled,
    sttEnabled,
    serverTranscribeEnabled,
  }
}

/**
 * Minimal typings for Web Speech API and MediaRecorder to keep TS strict without dom lib upgrades.
 */
type SpeechRecognitionConstructor = new () => SpeechRecognition
interface SpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onaudioend: ((this: SpeechRecognition, ev: Event) => unknown) | null
  onaudiostart: ((this: SpeechRecognition, ev: Event) => unknown) | null
  onend: ((this: SpeechRecognition, ev: Event) => unknown) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown) | null
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null
  onsoundend: ((this: SpeechRecognition, ev: Event) => unknown) | null
  onsoundstart: ((this: SpeechRecognition, ev: Event) => unknown) | null
  onspeechend: ((this: SpeechRecognition, ev: Event) => unknown) | null
  onspeechstart: ((this: SpeechRecognition, ev: Event) => unknown) | null
  onstart: ((this: SpeechRecognition, ev: Event) => unknown) | null
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}
interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
interface SpeechRecognitionResult {
  isFinal: boolean
  0: SpeechRecognitionAlternative
  length: number
}
interface SpeechRecognitionResultList {
  length: number
  item: (index: number) => SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

// MediaRecorder minimal typing
interface MediaRecorderConstructor {
  new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder
}
interface MediaRecorder extends EventTarget {
  state: 'inactive' | 'recording' | 'paused'
  mimeType: string
  start(timeslice?: number): void
  stop(): void
  pause(): void
  resume(): void
  ondataavailable: ((this: MediaRecorder, ev: BlobEvent) => unknown) | null
  onerror: ((this: MediaRecorder, ev: Event) => unknown) | null
  onstart: ((this: MediaRecorder, ev: Event) => unknown) | null
  onstop: ((this: MediaRecorder, ev: Event) => unknown) | null
}
interface MediaRecorderOptions {
  mimeType?: string
  audioBitsPerSecond?: number
  bitsPerSecond?: number
}
interface BlobEvent extends Event {
  data: Blob
}

/**
 * PUBLIC_INTERFACE
 * VoiceService API shape
 */
export type VoiceResultHandler = (text: string) => void
export type VoiceErrorHandler = (err: unknown) => void

export interface VoiceService {
  /** Start recording/transcription; returns false if disabled/unsupported */
  start(): Promise<boolean>
  /** Stop recording/transcription */
  stop(): Promise<void>
  /** Register result callback */
  onResult(cb: VoiceResultHandler): () => void
  /** Register error callback */
  onError(cb: VoiceErrorHandler): () => void
  /** Is currently recording/listening */
  isRecording(): boolean
}

/**
 * Internal state for the singleton service
 */
let recognition: SpeechRecognition | null = null
let mediaRecorder: MediaRecorder | null = null
let mediaStream: MediaStream | null = null
let recording = false
const resultSubs = new Set<VoiceResultHandler>()
const errorSubs = new Set<VoiceErrorHandler>()

function emitResult(text: string) {
  for (const cb of resultSubs) {
    try { cb(text) } catch { /* ignore */ }
  }
}
function emitError(err: unknown) {
  for (const cb of errorSubs) {
    try { cb(err) } catch { /* ignore */ }
  }
}

/**
 * Determine if Web Speech API is available.
 */
function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor; SpeechRecognition?: SpeechRecognitionConstructor }
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechRecognitionConstructor | null
}

/**
 * Determine if MediaRecorder is available for audio capture.
 */
function getMediaRecorderCtor(): MediaRecorderConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { MediaRecorder?: MediaRecorderConstructor }
  return (w.MediaRecorder || null) as MediaRecorderConstructor | null
}

async function startWithSpeechAPI(): Promise<boolean> {
  const SpeechRec = getSpeechRecognition()
  if (!SpeechRec) return false

  try {
    // Create instance
    recognition = new SpeechRec()
    recognition.lang = navigator?.language || 'en-US'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onresult = (ev: SpeechRecognitionEvent) => {
      try {
        for (let i = 0; i < ev.results.length; i++) {
          const res = ev.results[i]
          if (res && res[0] && res[0].transcript) {
            const text = String(res[0].transcript || '').trim()
            if (text) emitResult(text)
          }
        }
      } catch (e) {
        emitError(e)
      }
    }
    recognition.onerror = (ev: SpeechRecognitionErrorEvent) => {
      emitError({ error: ev.error, message: ev.message })
    }
    recognition.onend = () => {
      recording = false
    }
    recognition.onstart = () => {
      recording = true
    }

    recognition.start()
    return true
  } catch (e) {
    emitError(e)
    return false
  }
}

async function startWithMediaRecorderAndUpload(): Promise<boolean> {
  const MediaRec = getMediaRecorderCtor()
  if (!MediaRec) return false

  try {
    // Request microphone
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (e) {
    emitError(e)
    return false
  }

  try {
    // Choose a likely supported audio mime type
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ]
    let mimeType = ''
    const MR = (window as unknown as { MediaRecorder?: { isTypeSupported?: ((t: string) => boolean) | undefined } }).MediaRecorder
    const canCheckTypes = !!(MR && typeof MR.isTypeSupported === 'function')
    if (canCheckTypes) {
      const isTypeSupported = MR!.isTypeSupported as (t: string) => boolean
      for (const c of candidates) {
        try {
          if (isTypeSupported && isTypeSupported(c)) {
            mimeType = c
            break
          }
        } catch {
          // Some browsers throw for unknown types; ignore and continue
        }
      }
    }

    mediaRecorder = new MediaRec(mediaStream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []

    mediaRecorder.ondataavailable = (ev: BlobEvent) => {
      if (ev?.data && ev.data.size > 0) {
        chunks.push(ev.data)
      }
    }

    mediaRecorder.onstart = () => {
      recording = true
    }

    mediaRecorder.onerror = (ev: Event) => {
      emitError(ev)
    }

    mediaRecorder.onstop = async () => {
      recording = false
      try {
        const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
        // POST to backend transcription
        const res = await api.ingredients.transcribe(blob)
        // Prefer items -> join names, else use text
        if (res?.items && Array.isArray(res.items) && res.items.length > 0) {
          const text = res.items.map((it) => it.name + (it.quantity ? ` ${it.quantity}` : '')).join(', ')
          emitResult(text)
        } else if (typeof (res as { text?: string }).text === 'string') {
          emitResult((res as { text?: string }).text as string)
        } else {
          emitError(new Error('Transcription returned no text'))
        }
      } catch (e) {
        emitError(e)
      } finally {
        cleanupMedia()
      }
    }

    mediaRecorder.start()
    return true
  } catch (e) {
    emitError(e)
    cleanupMedia()
    return false
  }
}

function cleanupMedia() {
  try { mediaRecorder?.stop() } catch { /* ignore */ }
  mediaRecorder = null
  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      try { track.stop() } catch { /* ignore */ }
    }
  }
  mediaStream = null
}

/**
 * PUBLIC_INTERFACE
 * VoiceService singleton
 * - start(): try SpeechRecognition; if unavailable and allowed, fallback to MediaRecorder + POST
 * - stop(): stop recognition or media recorder
 * - onResult(cb): subscribe to text results; returns unsubscribe
 * - onError(cb): subscribe to errors
 * - isRecording(): current state
 */
const VoiceService: VoiceService = {
  async start(): Promise<boolean> {
    const { voiceEnabled, sttEnabled, serverTranscribeEnabled } = getFeatureFlags()
    if (!voiceEnabled) {
      // Feature disabled: no-op
      return false
    }

    // Try Web Speech API first if enabled
    const speechCtor = getSpeechRecognition()
    const speechSupported = speechCtor !== null
    if (sttEnabled && speechSupported) {
      const ok = await startWithSpeechAPI()
      if (ok) return true
      // Fallthrough to server mode if enabled
    }

    // Fallback to MediaRecorder + server transcription if allowed
    if (serverTranscribeEnabled && !!navigator.mediaDevices?.getUserMedia) {
      const ok = await startWithMediaRecorderAndUpload()
      if (ok) return true
    }

    return false
  },

  async stop(): Promise<void> {
    // Stop SpeechRecognition
    if (recognition) {
      try { recognition.stop() } catch { /* ignore */ }
      recognition = null
      recording = false
    }
    // Stop MediaRecorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop()
      } catch {
        // ignore
      }
    }
    cleanupMedia()
  },

  onResult(cb: VoiceResultHandler): () => void {
    resultSubs.add(cb)
    return () => { resultSubs.delete(cb) }
  },

  onError(cb: VoiceErrorHandler): () => void {
    errorSubs.add(cb)
    return () => { errorSubs.delete(cb) }
  },

  isRecording(): boolean {
    return recording
  },
}

export default VoiceService
