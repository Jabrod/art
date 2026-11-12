/**
 * The studio's backend on art.jabrod.com: jabrod.com's /api/art routes, reached on the same
 * origin with the Jabrod session cookie. Accounts, AI and credits are there, not here.
 * NEXT_PUBLIC_ART_API points somewhere else (another host running a compatible API).
 */
import { upload as blobUpload } from "@vercel/blob/client"
import type { AssetRef, BoardDoc } from "@/lib/board"
import { parseBoardDoc } from "@/lib/board"
import { ArtError, type Board, type BoardStore, type BoardSummary, type Chat, type ChatMessage, type LibraryAsset, type Me, type Models, type SaveResult } from "./types"

const BASE = `${process.env.NEXT_PUBLIC_ART_API ?? ""}/api/art`

async function call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      cache: "no-store",
      ...rest,
      headers: json === undefined ? rest.headers : { "content-type": "application/json", ...rest.headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
    })
  } catch {
    throw new ArtError("Couldn't reach Jabrod. Check your connection and try again.", "network")
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    const message = typeof body?.error_description === "string" ? body.error_description : `Something went wrong (${res.status}). Try again.`
    throw new ArtError(message, typeof body?.error === "string" ? body.error : "error", res.status)
  }
  return body as T
}

const toBoard = (b: { id: string; title: string; doc: unknown; updatedAt: string }): Board => ({ ...b, doc: parseBoardDoc(b.doc) })

export const remoteStore: BoardStore = {
  mode: "remote",
  me: async () => {
    try {
      return await call<Me>("/me")
    } catch (error) {
      if (error instanceof ArtError && error.status === 401) {
        const next = typeof window === "undefined" ? "/studio" : window.location.pathname
        return { signedIn: false, signInUrl: `/sign-in?next=${encodeURIComponent(next)}` }
      }
      throw error
    }
  },
  models: () => call<Models>("/models"),
  listBoards: async () => (await call<{ boards: BoardSummary[] }>("/boards")).boards,
  createBoard: async (title) => toBoard((await call<{ board: Board }>("/boards", { method: "POST", json: { title } })).board),
  getBoard: async (id) => toBoard((await call<{ board: Board }>(`/boards/${id}`)).board),
  saveBoard: async (id, change, updatedAt) => {
    try {
      return await call<SaveResult>(`/boards/${id}`, { method: "PUT", json: { ...change, updatedAt } })
    } catch (error) {
      if (error instanceof ArtError && error.status === 409) return { conflict: true }
      throw error
    }
  },
  deleteBoard: async (id) => {
    await call(`/boards/${id}`, { method: "DELETE" })
  },
  upload: async (file, boardId, info, onProgress) => {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file"
    let blob
    try {
      blob = await blobUpload(`art/${safeName}`, file, {
        access: "public",
        handleUploadUrl: `${BASE}/upload`,
        clientPayload: JSON.stringify({ boardId, kind: info.kind, size: file.size }),
        multipart: file.size > 20 * 1024 * 1024,
        contentType: file.type,
        onUploadProgress: (p) => onProgress?.(p.percentage / 100),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      throw new ArtError(message.includes("not allowed") || message.includes("size") ? `${file.name} can't be uploaded: ${message}` : `Couldn't upload ${file.name}. Try again.`, "upload")
    }
    const { asset } = await call<{ asset: AssetRef }>("/assets", {
      method: "POST",
      json: { boardId, url: blob.url, pathname: blob.pathname, name: file.name, mime: file.type, bytes: file.size, ...info },
    })
    return asset
  },
  resolveUrl: async (asset) => asset.url,
  generateImage: (req) => call("/generate/image", { method: "POST", json: req }),
  generateSpeech: (req) => call("/generate/speech", { method: "POST", json: req }),
  startVideo: (req) => call("/generate/video", { method: "POST", json: req }),
  videoStatus: (job, boardId, prompt) =>
    call(`/generate/video/status?job=${encodeURIComponent(job)}&board=${encodeURIComponent(boardId ?? "")}&prompt=${encodeURIComponent((prompt ?? "").slice(0, 300))}`),
  listAssets: async (kind, before) => {
    const q = new URLSearchParams()
    if (kind) q.set("kind", kind)
    if (before) q.set("before", before)
    return (await call<{ assets: LibraryAsset[] }>(`/assets?${q}`)).assets
  },
  listChats: async (opts = {}) => {
    const q = new URLSearchParams()
    if (opts.q) q.set("q", opts.q)
    if (opts.boardId) q.set("board", opts.boardId)
    return (await call<{ chats: Chat[] }>(`/chats?${q}`)).chats
  },
  createChat: async (opts) => (await call<{ chat: Chat }>("/chats", { method: "POST", json: opts })).chat,
  getChat: (id) => call<{ chat: Chat; messages: ChatMessage[] }>(`/chats/${id}`),
  updateChat: async (id, change) => (await call<{ chat: Chat }>(`/chats/${id}`, { method: "PATCH", json: change })).chat,
  deleteChat: async (id) => {
    await call(`/chats/${id}`, { method: "DELETE" })
  },
  sendMessage: async (chatId, content, model, onDelta, signal) => {
    let res: Response
    try {
      res = await fetch(`${BASE}/chats/${chatId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, model }),
        signal,
      })
    } catch (error) {
      if ((error as Error).name === "AbortError") return { title: "" }
      throw new ArtError("Couldn't reach Jabrod. Check your connection and try again.", "network")
    }
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => null)) as Record<string, string> | null
      throw new ArtError(body?.error_description ?? `Something went wrong (${res.status}). Try again.`, body?.error ?? "error", res.status)
    }
    const title = decodeURIComponent(res.headers.get("x-chat-title") ?? "")
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        onDelta(decoder.decode(value, { stream: true }))
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") throw new ArtError("The reply was cut off. Try again.", "network")
    }
    return { title }
  },
}

export type { BoardDoc }
