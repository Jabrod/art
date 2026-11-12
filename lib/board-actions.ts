"use client"

import type { AssetRef, NodeKind } from "@/lib/board"
import { freeSpot, makeNode, newEdgeId, nodeForAsset } from "@/lib/nodes"
import { store } from "@/lib/store"

export type BoardItem = { asset: AssetRef; prompt?: string } | { kind: NodeKind; text: string }

/**
 * Adds things to a board that isn't open here (from a studio, the Library or a chat): loads it,
 * lays the new nodes out in a column to the right of what's there, and saves. When the items
 * include a prompt and media, the prompt is wired into the first media node.
 */
export async function addToBoard(boardId: string, items: BoardItem[]) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const board = await store.getBoard(boardId)
    const doc = board.doc
    const spot = freeSpot(doc)
    let y = spot.y
    const added = items.map((item) => {
      const node = "asset" in item ? nodeForAsset(item.asset, { x: spot.x + 340, y }, item.prompt) : makeNode(item.kind, { x: spot.x, y }, { text: item.text })
      y += node.height + 40
      return node
    })
    // A lone prompt goes left of the media column; wire it into the first media node.
    const prompt = added.find((n) => n.type === "prompt")
    const media = added.find((n) => n.type === "image" || n.type === "video" || n.type === "audio")
    if (prompt && media) {
      prompt.position = { x: spot.x, y: spot.y }
      doc.edges.push({ id: newEdgeId(), source: prompt.id, target: media.id })
    } else if (!prompt) {
      for (const n of added) n.position.x -= 340
    }
    doc.nodes.push(...added)
    const saved = await store.saveBoard(boardId, { doc }, board.updatedAt)
    if (!("conflict" in saved)) return board.title
  }
  throw new Error("The board changed while adding to it. Try again.")
}
