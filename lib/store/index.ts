import { localStore } from "./local"
import { remoteStore } from "./remote"
import type { BoardStore } from "./types"

/**
 * Which backend the studio uses:
 *   - remote: on Jabrod's art host (art.jabrod.com, art.localhost in development), or when
 *     NEXT_PUBLIC_ART_API points at a compatible backend.
 *   - local: anywhere else, e.g. `npm run dev` on its own at localhost:3100/studio. Boards and
 *     files stay in this browser; AI generation and chat need a Jabrod account.
 * NEXT_PUBLIC_ART_LOCAL=1 forces local mode.
 */
function pick(): BoardStore {
  if (process.env.NEXT_PUBLIC_ART_LOCAL === "1") return localStore
  if (process.env.NEXT_PUBLIC_ART_API) return remoteStore
  if (typeof window === "undefined") return remoteStore
  return window.location.hostname.startsWith("art.") ? remoteStore : localStore
}

export const store: BoardStore = pick()

export * from "./types"
