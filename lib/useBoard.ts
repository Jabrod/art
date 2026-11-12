"use client"

/**
 * The open board: React Flow's nodes and edges, undo/redo, and saving. Edits mark the board
 * dirty, and it saves 800 ms after the last one. A save that finds the board changed elsewhere
 * (409) reloads the latest version rather than overwrite it.
 */
import { applyEdgeChanges, applyNodeChanges, type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type Viewport } from "@xyflow/react"
import { create } from "zustand"
import { parseBoardDoc, type ArtNode, type BoardDoc, type NodeData, type NodeKind } from "@/lib/board"
import { makeNode, newEdgeId, sizeFor } from "@/lib/nodes"
import { store } from "@/lib/store"

export type FlowNode = Node<NodeData, NodeKind>

type SaveState = "saved" | "dirty" | "saving" | "error"
type Snapshot = { nodes: FlowNode[]; edges: Edge[] }

const toFlow = (n: ArtNode): FlowNode => ({ id: n.id, type: n.type, position: n.position, width: n.width, height: n.height, data: n.data })
const toArt = (n: FlowNode): ArtNode => ({
  id: n.id,
  type: n.type as NodeKind,
  position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
  width: Math.round(n.width ?? n.measured?.width ?? 0),
  height: Math.round(n.height ?? n.measured?.height ?? 0),
  data: n.data,
})

interface BoardState {
  boardId: string | null
  title: string
  updatedAt: string
  nodes: FlowNode[]
  edges: Edge[]
  viewport: Viewport
  loaded: boolean
  error: string | null
  save: SaveState
  past: Snapshot[]
  future: Snapshot[]
  /** upload progress by node id (0–1), runtime only */
  progress: Record<string, number>
  load(id: string): Promise<void>
  reset(): void
  onNodesChange(changes: NodeChange<FlowNode>[]): void
  onEdgesChange(changes: EdgeChange[]): void
  connect(c: Connection): void
  checkpoint(): void
  addNode(kind: NodeKind, position: { x: number; y: number }, data?: NodeData): string
  addNodes(nodes: ArtNode[], edges?: Edge[]): void
  update(id: string, patch: Partial<NodeData>, opts?: { resize?: boolean }): void
  setProgress(id: string, value: number | null): void
  setViewport(v: Viewport): void
  setTitle(title: string): void
  removeNodes(ids: string[]): void
  duplicateSelected(): void
  undo(): void
  redo(): void
  doc(): BoardDoc
  markDirty(): void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let saving: Promise<void> | null = null

export const useBoard = create<BoardState>((set, get) => {
  async function flush() {
    const s = get()
    if (!s.boardId || s.save !== "dirty") return
    if (saving) {
      await saving
      return flush()
    }
    const doc = s.doc()
    const thumb = doc.nodes.find((n) => n.data.asset?.kind === "image")?.data.asset?.url ?? null
    set({ save: "saving" })
    saving = (async () => {
      try {
        const result = await store.saveBoard(s.boardId!, { doc, title: s.title, thumbnail: thumb && !thumb.startsWith("idb:") ? thumb : null }, s.updatedAt)
        if ("conflict" in result) {
          set({ save: "saved" })
          await get().load(s.boardId!)
          set({ error: "This board was changed in another tab, so the latest version was loaded." })
          return
        }
        // Edits made while saving keep the board dirty; they go out on the next save.
        set((cur) => ({ updatedAt: result.updatedAt, save: cur.save === "saving" ? "saved" : cur.save }))
      } catch {
        set({ save: "error" })
      } finally {
        saving = null
      }
    })()
    await saving
    if (get().save === "dirty") schedule()
  }

  function schedule() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, 800)
  }

  const snapshot = (): Snapshot => ({ nodes: get().nodes, edges: get().edges })

  return {
    boardId: null,
    title: "",
    updatedAt: "",
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    loaded: false,
    error: null,
    save: "saved",
    past: [],
    future: [],
    progress: {},

    load: async (id) => {
      try {
        const board = await store.getBoard(id)
        set({
          boardId: id,
          title: board.title,
          updatedAt: board.updatedAt,
          nodes: board.doc.nodes.map(toFlow),
          edges: board.doc.edges.map((e) => ({ ...e, sourceHandle: e.sourceHandle ?? undefined, targetHandle: e.targetHandle ?? undefined })),
          viewport: board.doc.viewport,
          loaded: true,
          error: null,
          save: "saved",
          past: [],
          future: [],
        })
      } catch (e) {
        set({ loaded: true, error: e instanceof Error ? e.message : "Couldn't open this board." })
      }
    },
    reset: () => {
      if (saveTimer) clearTimeout(saveTimer)
      set({ boardId: null, nodes: [], edges: [], loaded: false, error: null, past: [], future: [], progress: {}, save: "saved" })
    },
    markDirty: () => {
      set({ save: "dirty" })
      schedule()
    },
    checkpoint: () => set((s) => ({ past: [...s.past.slice(-49), snapshot()], future: [] })),

    onNodesChange: (changes) => {
      const meaningful = changes.some((c) => c.type === "position" || c.type === "remove" || c.type === "add" || (c.type === "dimensions" && c.resizing))
      if (changes.some((c) => c.type === "remove")) get().checkpoint()
      set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }))
      if (meaningful) get().markDirty()
    },
    onEdgesChange: (changes) => {
      if (changes.some((c) => c.type === "remove")) get().checkpoint()
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }))
      if (changes.some((c) => c.type === "remove" || c.type === "add")) get().markDirty()
    },
    connect: (c) => {
      if (!c.source || !c.target || c.source === c.target) return
      if (get().edges.some((e) => e.source === c.source && e.target === c.target)) return
      get().checkpoint()
      set((s) => ({ edges: [...s.edges, { id: newEdgeId(), source: c.source, target: c.target, sourceHandle: c.sourceHandle ?? undefined, targetHandle: c.targetHandle ?? undefined }] }))
      get().markDirty()
    },
    addNode: (kind, position, data) => {
      const node = makeNode(kind, position, data)
      get().checkpoint()
      set((s) => ({ nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), { ...toFlow(node), selected: true }] }))
      get().markDirty()
      return node.id
    },
    addNodes: (nodes, edges = []) => {
      get().checkpoint()
      set((s) => ({ nodes: [...s.nodes, ...nodes.map(toFlow)], edges: [...s.edges, ...edges] }))
      get().markDirty()
    },
    update: (id, patch, opts) => {
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (n.id !== id) return n
          const data = { ...n.data, ...patch }
          if (!opts?.resize) return { ...n, data }
          const size = sizeFor(n.type as NodeKind, data, n.width ?? undefined)
          return { ...n, data, width: size.width, height: size.height }
        }),
      }))
      get().markDirty()
    },
    setProgress: (id, value) =>
      set((s) => {
        const progress = { ...s.progress }
        if (value == null) delete progress[id]
        else progress[id] = value
        return { progress }
      }),
    setViewport: (viewport) => {
      set({ viewport })
      get().markDirty()
    },
    setTitle: (title) => {
      set({ title })
      get().markDirty()
    },
    removeNodes: (ids) => {
      if (ids.length === 0) return
      get().checkpoint()
      const gone = new Set(ids)
      set((s) => ({ nodes: s.nodes.filter((n) => !gone.has(n.id)), edges: s.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)) }))
      get().markDirty()
    },
    duplicateSelected: () => {
      const selected = get().nodes.filter((n) => n.selected)
      if (selected.length === 0) return
      get().checkpoint()
      const copies = selected.map((n) => {
        const copy = makeNode(n.type as NodeKind, { x: n.position.x + 40, y: n.position.y + 40 }, { ...n.data, job: undefined, status: n.data.status === "working" ? "idle" : n.data.status })
        return { ...toFlow({ ...copy, width: n.width ?? copy.width, height: n.height ?? copy.height }), selected: true }
      })
      set((s) => ({ nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...copies] }))
      get().markDirty()
    },
    undo: () => {
      const s = get()
      const prev = s.past[s.past.length - 1]
      if (!prev) return
      set({ past: s.past.slice(0, -1), future: [snapshot(), ...s.future].slice(0, 50), nodes: prev.nodes, edges: prev.edges })
      get().markDirty()
    },
    redo: () => {
      const s = get()
      const next = s.future[0]
      if (!next) return
      set({ future: s.future.slice(1), past: [...s.past, snapshot()], nodes: next.nodes, edges: next.edges })
      get().markDirty()
    },
    doc: () => {
      const s = get()
      return parseBoardDoc({ version: 1, nodes: s.nodes.map(toArt), edges: s.edges, viewport: s.viewport })
    },
  }
})

/** Saves now (leaving the page, closing the tab). */
export function flushBoard() {
  if (saveTimer) clearTimeout(saveTimer)
  const s = useBoard.getState()
  if (s.save === "dirty") s.markDirty()
}
