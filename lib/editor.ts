import type { AssetRef } from "@/lib/board"
import { BASE } from "@/lib/app-state"

/** The Editor page with this file queued to open (EditorPage reads ?url and ?name). */
export const editorHref = (asset: Pick<AssetRef, "url" | "name" | "kind">) =>
  `${BASE}/editor?${new URLSearchParams({ url: asset.url, name: asset.name ?? `${asset.kind}` })}`
