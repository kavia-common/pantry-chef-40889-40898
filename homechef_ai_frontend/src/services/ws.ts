type ImportMetaEnvSafe = {
  VITE_WS_URL?: string
  VITE_FEATURE_FLAGS?: string
}
type ImportMetaSafe = {
  env?: ImportMetaEnvSafe
}

/**
 * PUBLIC_INTERFACE
 * WebSocketService - Lightweight WS helper with optional feature-flag gating.
 *
 * Behavior:
 * - Uses import.meta.env.VITE_WS_URL as default endpoint.
 * - If VITE_WS_URL is unset or empty, all operations no-op gracefully.
 * - Optional feature flag gate: if feature flag "streaming" is disabled, connect() no-ops and status will be 'disabled'.
 * - Consumers can:
 *    - connect(url?) to establish a connection (or use env default)
 *    - subscribe(fn) to receive messages (JSON parsed if possible; otherwise raw string/binary)
 *    - send(data) to send JSON/string/binary
 *    - close() to terminate connection
 *    - onStatusChange(fn) to react to status transitions
 *
 * Status lifecycle:
 * - 'idle' (initial) -> 'disabled' (when ws/flag unavailable)
 * - 'connecting' -> 'open' -> 'closing' -> 'closed'
 * - 'error' on errors
 *
 * Feature flags (from env and to be extended to app store later):
 * - VITE_FEATURE_FLAGS can be a comma-separated list, e.g., "streaming,alpha"
 * - If "streaming" is NOT present, streaming is considered disabled.
 *
 * RecipeGenerator Usage example:
 * --------------------------------
 * import ws from '@/services/ws'
 *
 * // Subscribe to messages (e.g., token stream for recipe generation)
 * const unsubscribe = ws.subscribe((msg) => {
 *   // msg could be object (if JSON), string, or Blob/ArrayBuffer
 *   if (typeof msg === 'object' && msg && 'type' in msg) {
 *     // handle structured events
 *   } else {
 *     // handle text chunks or other payloads
 *   }
 * })
 *
 * // Optionally react to connection status
 * const offStatus = ws.onStatusChange((s) => console.log('WS status:', s))
 *
 * // Connect using default URL (VITE_WS_URL) or override
 * ws.connect()
 *
 * // Send a message
 * ws.send({ action: 'start', topic: 'recipes', payload: { ingredients: ['egg', 'tomato'] } })
 *
 * // Later: cleanup
 * unsubscribe()
 * offStatus()
 * ws.close()
 */
export type WSStatus =
  | 'idle'
  | 'disabled'
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed'
  | 'error'

type MessageHandler = (data: unknown) => void
type StatusHandler = (status: WSStatus, ev?: Event | CloseEvent | Event | unknown) => void

function parseFeatureFlags(raw?: string): Set<string> {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

function getEnv() {
  const meta = (import.meta as unknown as ImportMetaSafe) || {}
  const env = meta.env || {}
  return {
    wsUrl: (env.VITE_WS_URL || '').trim(),
    flags: parseFeatureFlags(env.VITE_FEATURE_FLAGS),
  }
}

// Internal singleton state
let socket: WebSocket | null = null
let status: WSStatus = 'idle'
const subscribers = new Set<MessageHandler>()
const statusSubs = new Set<StatusHandler>()
let lastUrl: string | null = null

function setStatus(next: WSStatus, ev?: Event | CloseEvent | unknown) {
  status = next
  for (const cb of statusSubs) {
    try {
      cb(next, ev)
    } catch {
      // ignore subscriber errors
    }
  }
}

function canUseStreaming(): boolean {
  const { flags } = getEnv()
  // Consider streaming enabled only when "streaming" flag is present.
  // If no flags configured, default to enabled for flexibility.
  return flags.size === 0 || flags.has('streaming')
}

function getEffectiveUrl(override?: string): string | '' {
  const { wsUrl } = getEnv()
  const url = (override || wsUrl || '').trim()
  return url
}

function attachSocketHandlers(ws: WebSocket) {
  ws.onopen = (ev) => {
    setStatus('open', ev)
  }

  ws.onmessage = (ev: MessageEvent) => {
    let payload: unknown = ev.data
    // Attempt JSON parse on text messages
    if (typeof ev.data === 'string') {
      try {
        payload = JSON.parse(ev.data)
      } catch {
        payload = ev.data
      }
    }
    // Notify all subscribers
    for (const cb of subscribers) {
      try {
        cb(payload)
      } catch {
        // ignore handler errors
      }
    }
  }

  ws.onerror = (ev) => {
    setStatus('error', ev)
  }

  ws.onclose = (ev) => {
    setStatus('closed', ev)
    socket = null
  }
}

function ensureNoopDisabled(reasonStatus: WSStatus) {
  setStatus(reasonStatus)
  // Intentionally do not create a socket.
}

/**
 * PUBLIC_INTERFACE
 * connect
 * Establish a WebSocket connection.
 * @param url - Optional ws(s) URL; defaults to import.meta.env.VITE_WS_URL
 * @returns boolean indicating whether a connection attempt was initiated
 */
function connect(url?: string): boolean {
  // Check feature flag first
  if (!canUseStreaming()) {
    ensureNoopDisabled('disabled')
    return false
  }

  const effectiveUrl = getEffectiveUrl(url)
  if (!effectiveUrl) {
    // No env provided; operate as disabled/no-op
    ensureNoopDisabled('disabled')
    return false
  }

  // Reuse open socket if same URL
  if (socket && status === 'open' && lastUrl === effectiveUrl) {
    return true
  }

  try {
    if (socket) {
      // Close existing socket if any
      try {
        setStatus('closing')
        socket.close()
      } catch {
        // ignore
      }
      socket = null
    }

    lastUrl = effectiveUrl
    setStatus('connecting')
    socket = new WebSocket(effectiveUrl)
    attachSocketHandlers(socket)
    return true
  } catch (e) {
    setStatus('error', e as unknown)
    socket = null
    return false
  }
}

/**
 * PUBLIC_INTERFACE
 * subscribe
 * Register a message handler for received messages.
 * @param handler - callback invoked with parsed payload (JSON if parsable, else raw)
 * @returns function to unsubscribe
 */
function subscribe(handler: MessageHandler): () => void {
  subscribers.add(handler)
  return () => {
    subscribers.delete(handler)
  }
}

/**
 * PUBLIC_INTERFACE
 * onStatusChange
 * Register a handler for connection status updates.
 * @param handler - callback invoked with status transitions
 * @returns function to unsubscribe
 */
function onStatusChange(handler: StatusHandler): () => void {
  statusSubs.add(handler)
  // emit current status immediately to help consumers know the starting state
  try {
    handler(status)
  } catch {
    // ignore
  }
  return () => {
    statusSubs.delete(handler)
  }
}

/**
 * PUBLIC_INTERFACE
 * send
 * Send data over the socket if available.
 * - Objects are JSON.stringified
 * - Strings are sent as-is
 * - Blobs/ArrayBuffers are sent directly
 * No-op if socket is not open.
 */
function send(data: unknown): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return
  try {
    if (data instanceof Blob || data instanceof ArrayBuffer) {
      socket.send(data)
    } else if (typeof data === 'string') {
      socket.send(data)
    } else {
      socket.send(JSON.stringify(data ?? {}))
    }
  } catch {
    // ignore send errors
  }
}

/**
 * PUBLIC_INTERFACE
 * close
 * Close the current WebSocket connection (if any).
 */
function close(): void {
  if (!socket) {
    // reflect closed state even if there wasn't a socket
    if (status !== 'disabled') setStatus('closed')
    return
  }
  try {
    setStatus('closing')
    socket.close()
  } catch {
    // ignore
  } finally {
    socket = null
  }
}

// PUBLIC_INTERFACE
// Export a small service singleton for convenience
const WebSocketService = {
  connect,
  subscribe,
  onStatusChange,
  send,
  close,
  get status(): WSStatus {
    return status
  },
}

export default WebSocketService
