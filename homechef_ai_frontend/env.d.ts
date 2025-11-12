/// <reference types="vite/client" />

// This file augments Vite's ImportMetaEnv to provide strong typings for
// the environment variables used throughout the HomeChef AI frontend.
// Ensure this file remains at the project root (next to vite.config.ts)
// or is included via the tsconfig "include" so TypeScript picks it up.

// PUBLIC_INTERFACE
interface ImportMetaEnv {
  /** Base API path for REST calls (e.g., /api or https://api.example.com) */
  readonly VITE_API_BASE?: string;

  /** Full backend URL used by the frontend to call the server */
  readonly VITE_BACKEND_URL?: string;

  /** Public URL where the frontend is served */
  readonly VITE_FRONTEND_URL?: string;

  /** WebSocket endpoint URL (e.g., wss://example.com/ws) */
  readonly VITE_WS_URL?: string;

  /** Node environment indicator (e.g., development, production, test) */
  readonly VITE_NODE_ENV?: string;

  /** Next.js telemetry flag (carried for compatibility in shared envs) */
  readonly VITE_NEXT_TELEMETRY_DISABLED?: string;

  /** Whether to enable source maps in builds ("true"/"false") */
  readonly VITE_ENABLE_SOURCE_MAPS?: string;

  /** Port for the dev server or runtime environment */
  readonly VITE_PORT?: string;

  /** Whether to trust proxy headers in deployments ("true"/"false") */
  readonly VITE_TRUST_PROXY?: string;

  /** Log level for the app ("debug" | "info" | "warn" | "error", etc.) */
  readonly VITE_LOG_LEVEL?: string;

  /** Healthcheck path for readiness/liveness probes (e.g., /healthz) */
  readonly VITE_HEALTHCHECK_PATH?: string;

  /** Feature flags as JSON or CSV depending on usage */
  readonly VITE_FEATURE_FLAGS?: string;

  /** Toggle for experiments ("true"/"false") */
  readonly VITE_EXPERIMENTS_ENABLED?: string;
}

// PUBLIC_INTERFACE
interface ImportMeta {
  /** Vite-provided environment variables (typed via ImportMetaEnv) */
  readonly env: ImportMetaEnv;
}
