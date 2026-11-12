/**
 * Boards kept in this browser (IndexedDB), for running the studio with no Jabrod account:
 * clone, `npm run dev`, and the canvas, uploads and saving all work. AI generation needs
 * jabrod.com's gateway and credits, so it says so instead of pretending.
 */
import { emptyDoc, parseBoardDoc, type AssetRef } from "@/lib/board"
import { ArtError, type Board, type BoardStore, type BoardSummary } from "./types"

const DB = "jabrod-art-studio"
let dbPromise: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore("boards", { keyPath: "id" })
        req.result.createObjectStore("blobs")
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

async function tx<T>(store: "boards" | "blobs", mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = run(d.transaction(store, mode).objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const LOCAL_ONLY = "AI generation runs on art.jabrod.com with a Jabrod account. This studio is in local mode (boards stay in this browser), so add your own files instead."
const objectUrls = new Map<string, string>()
const now = () => new Date().toISOString()

export const localStore: BoardStore = {
  mode: "local",
  me: async () => ({ signedIn: true, user: { name: "Local studio", email: "" }, credits: { used: 0, limit: 0, left: 0, pro: false } }),
  models: async () => ({ chat: [], image: [], video: [], voice: [] }),
  listBoards: async () => {
    const all = (await tx<Board[]>("boards", "readonly", (s) => s.getAll() as IDBRequest<Board[]>)) ?? []
    return all
      .map((b): BoardSummary => ({ id: b.id, title: b.title, updatedAt: b.updatedAt, thumbnailUrl: null }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  createBoard: async (title) => {
    const board: Board = { id: crypto.randomUUID(), title: title || "Untitled board", doc: emptyDoc(), updatedAt: now() }
    await tx("boards", "readwrite", (s) => s.put(board))
    return board
  },
  getBoard: async (id) => {
    const b = await tx<Board | undefined>("boards", "readonly", (s) => s.get(id) as IDBRequest<Board | undefined>)
    if (!b) throw new ArtError("This board isn't in this browser.", "not_found", 404)
    return { ...b, doc: parseBoardDoc(b.doc) }
  },
  saveBoard: async (id, change, updatedAt) => {
    const b = await tx<Board | undefined>("boards", "readonly", (s) => s.get(id) as IDBRequest<Board | undefined>)
    if (!b) throw new ArtError("This board isn't in this browser.", "not_found", 404)
    if (b.updatedAt !== updatedAt) return { conflict: true }
    const next: Board = { ...b, title: change.title ?? b.title, doc: change.doc ?? b.doc, updatedAt: now() }
    await tx("boards", "readwrite", (s) => s.put(next))
    return { updatedAt: next.updatedAt }
  },
  deleteBoard: async (id) => {
    await tx("boards", "readwrite", (s) => s.delete(id))
  },
  upload: async (file, _boardId, info, onProgress) => {
    const id = crypto.randomUUID()
    await tx("blobs", "readwrite", (s) => s.put(file, id))
    onProgress?.(1)
    return { id, kind: info.kind, url: `idb:${id}`, name: file.name, mime: file.type, width: info.width, height: info.height, durationMs: info.durationMs }
  },
  resolveUrl: async (asset: AssetRef) => {
    if (!asset.url.startsWith("idb:")) return asset.url
    const cached = objectUrls.get(asset.id)
    if (cached) return cached
    const blob = await tx<Blob | undefined>("blobs", "readonly", (s) => s.get(asset.id) as IDBRequest<Blob | undefined>)
    if (!blob) throw new ArtError("This file isn't in this browser any more.", "not_found", 404)
    const url = URL.createObjectURL(blob)
    objectUrls.set(asset.id, url)
    return url
  },
  generateImage: async () => {
    throw new ArtError(LOCAL_ONLY, "local_mode")
  },
  generateSpeech: async () => {
    throw new ArtError(LOCAL_ONLY, "local_mode")
  },
  startVideo: async () => {
    throw new ArtError(LOCAL_ONLY, "local_mode")
  },
  videoStatus: async () => ({ status: "error", error: LOCAL_ONLY }),
  listAssets: async () => [],
  billing: async () => null,
  startCheckout: async () => {
    throw new ArtError("Plans are on art.jabrod.com with a Jabrod account. This studio is in local mode.", "local_mode")
  },
  syncCheckout: async () => ({ status: null }),
  billingPortal: async () => {
    throw new ArtError("Plans are on art.jabrod.com with a Jabrod account.", "local_mode")
  },
  listChats: async () => [],
  createChat: async () => {
    throw new ArtError("The assistant runs on art.jabrod.com with a Jabrod account. This studio is in local mode.", "local_mode")
  },
  getChat: async () => {
    throw new ArtError("This chat isn't in this browser.", "not_found", 404)
  },
  updateChat: async () => {
    throw new ArtError("Chats need a Jabrod account.", "local_mode")
  },
  deleteChat: async () => {},
  sendMessage: async () => {
    throw new ArtError("The assistant runs on art.jabrod.com with a Jabrod account. This studio is in local mode.", "local_mode")
  },
}
