type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// Narrow env access without using any
type ImportMetaEnvSafe = {
  VITE_API_BASE?: string
  VITE_BACKEND_URL?: string
}
type ImportMetaSafe = {
  env?: ImportMetaEnvSafe
}

/**
 * PUBLIC_INTERFACE
 * getApiBase
 * Resolve API base URL from environment variables.
 * Order: VITE_API_BASE -> VITE_BACKEND_URL -> window.location.origin (fallback)
 */
export function getApiBase(): string {
  const meta = (import.meta as unknown as ImportMetaSafe) || {}
  const base =
    meta.env?.VITE_API_BASE ||
    meta.env?.VITE_BACKEND_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  // Ensure no trailing slash for consistent path concatenation
  return String(base || '').replace(/\/+$/, '')
}

export interface ApiClientOptions {
  baseUrl?: string
  defaultHeaders?: Record<string, string>
  /**
   * Optional function hook to transform requests (e.g., add auth token)
   */
  onRequestInit?: (init: RequestInit) => RequestInit | Promise<RequestInit>
  /**
   * Optional function hook to inspect/transform responses globally
   */
  onResponse?: (response: Response) => void | Promise<void>
}

export interface ApiErrorPayload {
  message: string
  code?: string | number
  details?: unknown
  status?: number
}

/**
 * A conservative JSON-like type to avoid using any.
 * Allows nested arrays/objects with primitive values.
 */
type JSONPrimitive = string | number | boolean | null
type JSONLike = JSONPrimitive | JSONLike[] | { [key: string]: JSONLike }

export class ApiError extends Error {
  public code?: string | number
  public details?: unknown
  public status?: number

  constructor(payload: ApiErrorPayload) {
    super(payload.message || 'API Error')
    this.name = 'ApiError'
    this.code = payload.code
    this.details = payload.details
    this.status = payload.status
  }
}

/**
 * PUBLIC_INTERFACE
 * createApiClient
 * Factory to create a configured API client with grouped namespaces and unified error handling.
 */
export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = (options.baseUrl || getApiBase()).replace(/\/+$/, '')
  // Initialize as a clean string map; avoid spread on possibly untyped objects to keep strict typing.
  const defaultHeaders: Record<string, string> = {}
  if (options.defaultHeaders) {
    for (const [k, v] of Object.entries(options.defaultHeaders)) {
      defaultHeaders[k] = String(v)
    }
  }

  // Core fetch wrapper with JSON handling, error normalization, and optional hooks
  // Use a distributive conditional over a narrowed R to help TS avoid odd inferences
  type RequestReturn<T, R extends boolean> = [R] extends [true] ? Response : T

  async function request<T = JSONLike, R extends boolean = false>(
    path: string,
    opts: {
      method?: HttpMethod
      headers?: Record<string, string>
      body?: BodyInit | undefined | null
      signal?: AbortSignal
      /**
       * When true, returns the raw Response rather than parsing JSON
       */
      raw?: R
    } = {},
  ): Promise<RequestReturn<T, R>> {
    const {
      method = 'GET',
      headers,
      body,
      signal,
      raw = false as R,
    } = opts

    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`

    // Construct headers explicitly to satisfy TS typing and avoid loose inference
    const computedHeaders: Record<string, string> = {}
    // copy defaults
    for (const [k, v] of Object.entries(defaultHeaders)) {
      computedHeaders[k] = String(v)
    }
    // copy per-request headers ensuring string values
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        computedHeaders[k] = String(v)
      }
    }
    // Only add Content-Type when body is not FormData, so browser can set multipart boundaries.
    if (body != null && !(body instanceof FormData)) {
      if (body instanceof Blob) {
        if ((body as Blob).type) {
          computedHeaders['Content-Type'] = (body as Blob).type
        }
      } else if (typeof body === 'string') {
        const trimmed = body.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          computedHeaders['Content-Type'] = 'application/json'
        }
      } else if (typeof body === 'object') {
        // leave as is; callers using JSON will set header at call sites
      }
    }

    // Build RequestInit in a mutable way and assign headers explicitly as HeadersInit
    const init: RequestInit = {}
    init.method = method
    init.headers = computedHeaders as HeadersInit
    init.signal = signal
    init.credentials = 'include' // allow cookies if backend uses session-based auth
    if (body !== undefined && body !== null) {
      init.body = body as BodyInit
    }

    const finalInit: RequestInit = options.onRequestInit ? await options.onRequestInit(init) : init

    let res: Response
    try {
      res = await fetch(url, finalInit)
    } catch (networkErr) {
      // Network-level error (CORS, DNS, offline)
      const err = networkErr instanceof Error ? networkErr : new Error('Network error')
      throw new ApiError({
        message: err.message || 'Network error while contacting the API',
        code: 'NETWORK_ERROR',
        details: err,
      })
    }

    // Optional response hook (e.g., global logging, metrics)
    if (options.onResponse) {
      try {
        await options.onResponse(res)
      } catch {
        // Avoid hook errors breaking normal flow
      }
    }

    if (raw) {
      // Caller will handle stream/body reading
      return (res as unknown) as RequestReturn<T, R>
    }

    // Attempt to parse JSON body. Gracefully handle empty body.
    let data: unknown = null
    const text = await res.text()
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        // Non-JSON content; return as text for consumer if success, or use in error
        data = text
      }
    }

    if (!res.ok) {
      // Normalize error shape
      const isObj = typeof data === 'object' && data !== null
      const message =
        (isObj && 'message' in (data as Record<string, unknown>) && typeof (data as Record<string, unknown>).message === 'string'
          ? (data as Record<string, unknown>).message
          : undefined) ||
        (isObj && 'error' in (data as Record<string, unknown>) && typeof (data as Record<string, unknown>).error === 'string'
          ? (data as Record<string, unknown>).error
          : undefined) ||
        `Request failed with status ${res.status}`

      const code =
        (isObj && 'code' in (data as Record<string, unknown>) && ((data as Record<string, unknown>).code as string | number))
        || res.status

      const normalized: ApiErrorPayload = {
        message,
        code,
        details: data,
        status: res.status,
      }

      throw new ApiError(normalized)
    }

    return (data as T) as RequestReturn<T, R>
  }

  // Note: previously had a JSON shorthand helper; removed to avoid unused var lint error.

  // Namespaced API surface
  const client: {
    baseUrl: string
    ingredients: {
      parsePhoto: (imageFile: File | Blob, extra?: { signal?: AbortSignal; fields?: Record<string, string> }) => Promise<{ items: Array<{ name: string; quantity?: string }> }>
      transcribe: (audioBlob: Blob, extra?: { signal?: AbortSignal; fields?: Record<string, string> }) => Promise<{ text: string; items?: Array<{ name: string; quantity?: string }> }>
    }
    recipes: {
      generate: (payload: unknown, extra?: { signal?: AbortSignal }) => Promise<{ id: string; status: 'queued' | 'processing' | 'ready'; recipes?: JSONLike[] }>
      getStream: (id: string, opts?: { raw?: boolean; signal?: AbortSignal }) => Promise<Response | JSONLike>
    }
    nutrition: {
      analyze: (payload: unknown, extra?: { signal?: AbortSignal }) => Promise<{ calories?: number; macros?: Record<string, number>; details?: JSONLike }>
    }
    pantry: {
      list: (extra?: { signal?: AbortSignal }) => Promise<Array<{ id: string; name: string; quantity?: string; expiresAt?: string }>>
      create: (item: { name: string; quantity?: string; expiresAt?: string }, extra?: { signal?: AbortSignal }) => Promise<{ id: string; name: string; quantity?: string; expiresAt?: string }>
      update: (id: string, updates: Partial<{ name: string; quantity?: string; expiresAt?: string }>, extra?: { signal?: AbortSignal }) => Promise<{ id: string; name: string; quantity?: string; expiresAt?: string }>
      remove: (id: string, extra?: { signal?: AbortSignal }) => Promise<{ success: boolean }>
    }
    savedRecipes: {
      list: (extra?: { signal?: AbortSignal }) => Promise<Array<{ id: string; title: string; createdAt?: string }>>
      create: (payload: { recipeId?: string; title?: string; data?: unknown }, extra?: { signal?: AbortSignal }) => Promise<{ id: string; title?: string }>
    }
  } = {
    baseUrl,

    // Ingredients-related endpoints
    ingredients: {
      /**
       * PUBLIC_INTERFACE
       * Parse ingredients from an image (receipt/photo).
       * imageFile: a File object (from input) or Blob.
       * POST /ingredients/parse-photo
       */
      async parsePhoto(imageFile: File | Blob, extra?: { signal?: AbortSignal; fields?: Record<string, string> }) {
        const fd = new FormData()
        fd.append('image', imageFile)
        if (extra?.fields) {
          for (const [k, v] of Object.entries(extra.fields)) fd.append(k, v)
        }
        return request<{ items: Array<{ name: string; quantity?: string }> }>('/ingredients/parse-photo', {
          method: 'POST',
          body: fd,
          signal: extra?.signal,
        })
      },

      /**
       * PUBLIC_INTERFACE
       * Transcribe audio to ingredients or text.
       * audioBlob: Blob with audio data (e.g., from MediaRecorder).
       * POST /ingredients/transcribe
       */
      async transcribe(audioBlob: Blob, extra?: { signal?: AbortSignal; fields?: Record<string, string> }) {
        const fd = new FormData()
        fd.append('audio', audioBlob, 'voice.webm')
        if (extra?.fields) {
          for (const [k, v] of Object.entries(extra.fields)) fd.append(k, v)
        }
        return request<{ text: string; items?: Array<{ name: string; quantity?: string }> }>(
          '/ingredients/transcribe',
          {
            method: 'POST',
            body: fd,
            signal: extra?.signal,
          },
        )
      },
    },

    // Recipes endpoints
    recipes: {
      /**
       * PUBLIC_INTERFACE
       * Generate recipes from a payload (ingredients/preferences).
       * POST /recipes/generate
       */
      async generate(payload: unknown, extra?: { signal?: AbortSignal }) {
        const bodyObj: Record<string, unknown> =
          (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {}
        const bodyStr: string = JSON.stringify(bodyObj)
        return request<{ id: string; status: 'queued' | 'processing' | 'ready'; recipes?: JSONLike[] }>(
          '/recipes/generate',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' } as Record<string, string>,
            body: bodyStr as unknown as BodyInit, // ensure BodyInit type
            signal: extra?.signal,
          },
        )
      },

      /**
       * PUBLIC_INTERFACE
       * Get a recipe generation stream or result by id.
       * If backend supports text/event-stream, consider using raw Response.
       * GET /recipes/stream/:id
       */
      async getStream(id: string, opts?: { raw?: boolean; signal?: AbortSignal }) {
        const path = `/recipes/stream/${encodeURIComponent(id)}`
        if (opts?.raw) {
          return request<Response, true>(path, { method: 'GET', raw: true, signal: opts.signal })
        }
        return request<JSONLike>(path, { method: 'GET', signal: opts?.signal })
      },
    },

    // Nutrition endpoints
    nutrition: {
      /**
       * PUBLIC_INTERFACE
       * Analyze nutrition for a given payload.
       * POST /nutrition/analyze
       */
      async analyze(payload: unknown, extra?: { signal?: AbortSignal }) {
        const bodyStr: string = JSON.stringify(payload ?? {})
        return request<{ calories?: number; macros?: Record<string, number>; details?: JSONLike }>(
          '/nutrition/analyze',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' } as Record<string, string>,
            body: bodyStr,
            signal: extra?.signal,
          },
        )
      },
    },

    // Pantry endpoints
    pantry: {
      /**
       * PUBLIC_INTERFACE
       * List pantry items.
       * GET /pantry
       */
      async list(extra?: { signal?: AbortSignal }) {
        return request<Array<{ id: string; name: string; quantity?: string; expiresAt?: string }>>('/pantry', {
          method: 'GET',
          signal: extra?.signal,
        })
      },

      /**
       * PUBLIC_INTERFACE
       * Create a pantry item.
       * POST /pantry
       */
      async create(item: { name: string; quantity?: string; expiresAt?: string }, extra?: { signal?: AbortSignal }) {
        const payload = (item ?? { name: '' }) as Record<string, unknown>
        const bodyStr = JSON.stringify(payload)
        // Use Blob to ensure BodyInit typing across TS lib versions
        const bodyInit: BodyInit = new Blob([bodyStr], { type: 'application/json' })
        return request<{ id: string; name: string; quantity?: string; expiresAt?: string }>('/pantry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' } as Record<string, string>,
          body: bodyInit,
          signal: extra?.signal,
        })
      },

      /**
       * PUBLIC_INTERFACE
       * Update a pantry item by id.
       * PUT /pantry/:id
       */
      async update(
        id: string,
        updates: Partial<{ name: string; quantity?: string; expiresAt?: string }>,
        extra?: { signal?: AbortSignal },
      ) {
        const payload = (updates ?? {}) as Record<string, unknown>
        const bodyStr = JSON.stringify(payload)
        const bodyInit: BodyInit = new Blob([bodyStr], { type: 'application/json' })
        return request<{ id: string; name: string; quantity?: string; expiresAt?: string }>(
          `/pantry/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' } as unknown as Record<string, string>,
            body: bodyInit,
            signal: extra?.signal,
          },
        )
      },

      /**
       * PUBLIC_INTERFACE
       * Remove a pantry item by id.
       * DELETE /pantry/:id
       */
      async remove(id: string, extra?: { signal?: AbortSignal }) {
        return request<{ success: boolean }>(`/pantry/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          signal: extra?.signal,
        })
      },
    },

    // Saved recipes/collections
    savedRecipes: {
      /**
       * PUBLIC_INTERFACE
       * List saved recipes.
       * GET /saved-recipes
       */
      async list(extra?: { signal?: AbortSignal }) {
        return request<Array<{ id: string; title: string; createdAt?: string }>>('/saved-recipes', {
          method: 'GET',
          signal: extra?.signal,
        })
      },

      /**
       * PUBLIC_INTERFACE
       * Create/save a recipe entry.
       * POST /saved-recipes
       */
      async create(
        payload: { recipeId?: string; title?: string; data?: unknown },
        extra?: { signal?: AbortSignal },
      ) {
        const bodyStr: string = JSON.stringify(payload ?? {})
        return request<{ id: string; title?: string }>(
          '/saved-recipes',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyStr,
            signal: extra?.signal,
          },
        )
      },
    },
  }

  return client
}

// PUBLIC_INTERFACE
// Default exported singleton client configured from env.
// Prefer importing this for most use-cases, or call createApiClient for custom config.
const api = createApiClient()
export default api
