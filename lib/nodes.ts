import { FRAME, mediaHeight, type ArtNode, type AssetRef, type BoardDoc, type NodeData, type NodeKind } from "@/lib/board"

/** Node chrome around the media frame: the header bar and the footer with the prompt and action. */
export const HEADER = 34
export const FOOTER = 46

/** Each kind's dab: paint sampled from the "Introducing Jabrod ART" film strokes (globals.css). */
export const KIND_COLOR: Record<NodeKind, string> = {
  prompt: "#d34265",
  note: "rgba(243,238,226,0.55)",
  image: "#aa256c",
  video: "#265c95",
  audio: "#e5675b",
  export: "#54207d",
}

export const KIND_LABEL: Record<NodeKind, string> = {
  prompt: "Prompt",
  note: "Note",
  image: "Image",
  video: "Video",
  audio: "Audio",
  export: "Export",
}

/** The size a node should be for its media: fixed width, height from the aspect ratio. */
export function sizeFor(kind: NodeKind, data: NodeData, width = FRAME[kind].width) {
  if (kind === "image" || kind === "video") {
    const aspect = data.asset?.width && data.asset.height ? data.asset : data.aspect || (kind === "video" ? "16:9" : "1:1")
    return { width, height: HEADER + mediaHeight(width, aspect) + FOOTER }
  }
  return { width, height: FRAME[kind].height }
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2))

export function makeNode(kind: NodeKind, position: { x: number; y: number }, data: NodeData = {}): ArtNode {
  const defaults: NodeData =
    kind === "video" ? { aspect: "16:9", seconds: undefined, audio: false } : kind === "image" ? { aspect: "1:1" } : {}
  const merged = { ...defaults, ...data, status: data.status ?? "idle" }
  return { id: uid(), type: kind, position, ...sizeFor(kind, merged), data: merged }
}

/** A media node for an asset that already exists (upload, Library, studio result). */
export function nodeForAsset(asset: AssetRef, position: { x: number; y: number }, prompt?: string) {
  return makeNode(asset.kind, position, { asset, prompt, label: asset.name })
}

/** Where new nodes go on a board: to the right of everything already there, top-aligned. */
export function freeSpot(doc: Pick<BoardDoc, "nodes">) {
  if (doc.nodes.length === 0) return { x: 0, y: 0 }
  let right = -Infinity
  let top = Infinity
  for (const n of doc.nodes) {
    right = Math.max(right, n.position.x + n.width)
    top = Math.min(top, n.position.y)
  }
  return { x: right + 80, y: top }
}

export const newEdgeId = () => `e-${uid()}`
