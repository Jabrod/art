/**
 * The board document: what a board saves and loads. It is versioned so later studios can
 * migrate old boards, and it holds only serialisable, durable fields. Runtime state (is a
 * clip playing, how far a scrub has got) lives in components and never reaches the document.
 *
 * Media files are never inside the document: nodes carry an AssetRef (a URL plus metadata).
 */

export type NodeKind = "prompt" | "note" | "image" | "video" | "audio" | "export"
export const NODE_KINDS: NodeKind[] = ["prompt", "note", "image", "video", "audio", "export"]

export type MediaKind = "image" | "video" | "audio"

export interface AssetRef {
  id: string
  kind: MediaKind
  url: string
  name?: string
  mime?: string
  width?: number
  height?: number
  durationMs?: number
}

export type NodeStatus = "idle" | "working" | "error"

/** Every field any node kind uses. Each kind reads the ones it needs. */
export interface NodeData {
  /** prompt / note text, or the words an audio node speaks */
  text?: string
  /** a generator's own prompt (added after any connected prompts) */
  prompt?: string
  model?: string
  aspect?: string
  seconds?: number
  resolution?: string
  audio?: boolean
  voice?: string
  asset?: AssetRef
  /** a running video job's token, so a reload can resume polling */
  job?: string
  status?: NodeStatus
  error?: string
  label?: string
  [key: string]: unknown
}

export interface ArtNode {
  id: string
  type: NodeKind
  position: { x: number; y: number }
  width: number
  height: number
  data: NodeData
}

export interface ArtEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface BoardDoc {
  version: 1
  nodes: ArtNode[]
  edges: ArtEdge[]
  viewport: Viewport
}

export const MAX_DOC_BYTES = 1_000_000

export const emptyDoc = (): BoardDoc => ({ version: 1, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } })

/** Default frame sizes. A node's size is fixed, so nothing reflows while its media loads. */
export const FRAME: Record<NodeKind, { width: number; height: number }> = {
  prompt: { width: 280, height: 176 },
  note: { width: 240, height: 140 },
  image: { width: 300, height: 360 },
  video: { width: 340, height: 330 },
  audio: { width: 300, height: 200 },
  export: { width: 280, height: 240 },
}

/** Width and height of a media frame for an aspect ratio, keeping the node's width. */
export function mediaHeight(width: number, aspect: { width?: number; height?: number } | string | undefined) {
  let ratio = 1
  if (typeof aspect === "string") {
    const [w, h] = aspect.split(":").map(Number)
    if (w > 0 && h > 0) ratio = h / w
  } else if (aspect?.width && aspect.height) {
    ratio = aspect.height / aspect.width
  }
  return Math.round(Math.min(Math.max(width * ratio, width * 0.4), width * 1.8))
}

const DATA_KEYS = ["text", "prompt", "model", "aspect", "seconds", "resolution", "audio", "voice", "asset", "job", "status", "error", "label"] as const

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback)
const str = (v: unknown) => (typeof v === "string" ? v : undefined)

function parseAsset(raw: unknown): AssetRef | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const a = raw as Record<string, unknown>
  const kind = a.kind
  if (typeof a.url !== "string" || typeof a.id !== "string") return undefined
  if (kind !== "image" && kind !== "video" && kind !== "audio") return undefined
  return {
    id: a.id,
    kind,
    url: a.url,
    name: str(a.name),
    mime: str(a.mime),
    width: typeof a.width === "number" ? a.width : undefined,
    height: typeof a.height === "number" ? a.height : undefined,
    durationMs: typeof a.durationMs === "number" ? a.durationMs : undefined,
  }
}

function parseData(raw: unknown): NodeData {
  const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const out: NodeData = {}
  for (const key of DATA_KEYS) {
    const v = d[key]
    if (v === undefined || v === null) continue
    if (key === "asset") {
      const asset = parseAsset(v)
      if (asset) out.asset = asset
    } else if (key === "seconds") {
      if (typeof v === "number") out.seconds = v
    } else if (key === "audio") {
      if (typeof v === "boolean") out.audio = v
    } else if (key === "status") {
      if (v === "idle" || v === "working" || v === "error") out.status = v
    } else if (typeof v === "string") {
      out[key] = v
    }
  }
  // "working" survives a reload only when there's a job to resume (video). Anything else
  // was cut off mid-request and is idle again.
  if (out.status === "working" && !out.job) out.status = "idle"
  return out
}

/** A board document from anything (the database, IndexedDB, a pasted file). Never throws. */
export function parseBoardDoc(raw: unknown): BoardDoc {
  if (!raw || typeof raw !== "object") return emptyDoc()
  const r = raw as Record<string, unknown>
  const nodes: ArtNode[] = []
  const ids = new Set<string>()
  for (const n of Array.isArray(r.nodes) ? r.nodes : []) {
    if (!n || typeof n !== "object") continue
    const node = n as Record<string, unknown>
    const type = node.type as NodeKind
    if (typeof node.id !== "string" || !NODE_KINDS.includes(type) || ids.has(node.id)) continue
    const pos = (node.position ?? {}) as Record<string, unknown>
    ids.add(node.id)
    nodes.push({
      id: node.id,
      type,
      position: { x: num(pos.x, 0), y: num(pos.y, 0) },
      width: num(node.width, FRAME[type].width),
      height: num(node.height, FRAME[type].height),
      data: parseData(node.data),
    })
  }
  const edges: ArtEdge[] = []
  for (const e of Array.isArray(r.edges) ? r.edges : []) {
    if (!e || typeof e !== "object") continue
    const edge = e as Record<string, unknown>
    if (typeof edge.id !== "string" || typeof edge.source !== "string" || typeof edge.target !== "string") continue
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue
    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: str(edge.sourceHandle) ?? null,
      targetHandle: str(edge.targetHandle) ?? null,
    })
  }
  const v = (r.viewport ?? {}) as Record<string, unknown>
  return { version: 1, nodes, edges, viewport: { x: num(v.x, 0), y: num(v.y, 0), zoom: Math.min(Math.max(num(v.zoom, 1), 0.05), 4) } }
}

const TEXT_SOURCES: NodeKind[] = ["prompt", "note"]

/**
 * The prompt a generator node runs with: the text of every prompt or note wired into it, in
 * the order the edges were made, then the node's own prompt. Empty parts are skipped.
 */
export function promptFor(nodeId: string, doc: Pick<BoardDoc, "nodes" | "edges">): string {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]))
  const parts: string[] = []
  for (const edge of doc.edges) {
    if (edge.target !== nodeId) continue
    const source = byId.get(edge.source)
    if (!source || !TEXT_SOURCES.includes(source.type)) continue
    const text = source.data.text?.trim()
    if (text) parts.push(text)
  }
  const self = byId.get(nodeId)
  const own = (self?.type === "audio" ? self.data.text : self?.data.prompt)?.trim()
  if (own) parts.push(own)
  return parts.join("\n\n")
}

/** The media wired into a node (used by Export), in edge order, without duplicates. */
export function incomingMedia(nodeId: string, doc: Pick<BoardDoc, "nodes" | "edges">): AssetRef[] {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]))
  const seen = new Set<string>()
  const out: AssetRef[] = []
  for (const edge of doc.edges) {
    if (edge.target !== nodeId) continue
    const asset = byId.get(edge.source)?.data.asset
    if (asset && !seen.has(asset.id)) {
      seen.add(asset.id)
      out.push(asset)
    }
  }
  return out
}

/** Which kind of media node a file becomes, or null when the studio can't hold it. */
export function kindForMime(mime: string): MediaKind | null {
  if (/^image\/(png|jpe?g|webp|gif|avif)$/.test(mime)) return "image"
  if (/^video\/(mp4|webm|quicktime)$/.test(mime)) return "video"
  if (/^audio\/(mpeg|mp3|wav|x-wav|wave|ogg|webm|mp4|aac|x-m4a|flac)$/.test(mime)) return "audio"
  return null
}

export const MAX_UPLOAD_BYTES: Record<MediaKind, number> = {
  image: 20 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  video: 500 * 1024 * 1024,
}

/** Why a file can't be added, or null when it can. */
export function uploadProblem(file: { type: string; size: number; name: string }): string | null {
  const kind = kindForMime(file.type)
  if (!kind) return `${file.name} isn't an image, video or audio file the studio can hold (PNG, JPEG, WebP, GIF, MP4, WebM, MOV, MP3, WAV, OGG, M4A, FLAC).`
  if (file.size > MAX_UPLOAD_BYTES[kind]) return `${file.name} is larger than ${MAX_UPLOAD_BYTES[kind] / 1024 / 1024} MB, the limit for ${kind} files.`
  return null
}
