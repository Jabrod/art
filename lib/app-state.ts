"use client"

/**
 * App-wide state: who is signed in, credits, the model catalogue, the sidebar's chat history,
 * and toasts. Each page owns its own data beyond that.
 */
import { create } from "zustand"
import { store, type Chat, type Credits, type Me, type Models } from "@/lib/store"

export const BASE = "/studio"
/** A file in the studio's public folder (served under the basePath). */
export const pub = (path: string) => `${BASE}${path}`

export interface Toast {
  id: number
  text: string
  tone: "info" | "error" | "ok"
}

interface AppState {
  me: Me | null
  meError: string | null
  models: Models | null
  chats: Chat[]
  chatsLoaded: boolean
  toasts: Toast[]
  sidebarOpen: boolean
  loadMe(): Promise<void>
  loadModels(): Promise<void>
  loadChats(): Promise<void>
  setCredits(c: Credits): void
  upsertChat(chat: Chat): void
  removeChat(id: string): void
  toast(text: string, tone?: Toast["tone"]): void
  dismiss(id: number): void
  setSidebar(open: boolean): void
}

let toastId = 0

export const useApp = create<AppState>((set, get) => ({
  me: null,
  meError: null,
  models: null,
  chats: [],
  chatsLoaded: false,
  toasts: [],
  sidebarOpen: true,
  loadMe: async () => {
    try {
      set({ me: await store.me(), meError: null })
    } catch (error) {
      set({ meError: error instanceof Error ? error.message : "Couldn't reach Jabrod." })
    }
  },
  loadModels: async () => {
    if (get().models) return
    try {
      set({ models: await store.models() })
    } catch {
      // generation controls show "no models" until it loads
    }
  },
  loadChats: async () => {
    try {
      set({ chats: await store.listChats(), chatsLoaded: true })
    } catch {
      set({ chatsLoaded: true })
    }
  },
  setCredits: (c) => {
    const me = get().me
    if (me?.credits) set({ me: { ...me, credits: { ...me.credits, ...c } } })
  },
  upsertChat: (chat) => set({ chats: [chat, ...get().chats.filter((c) => c.id !== chat.id)] }),
  removeChat: (id) => set({ chats: get().chats.filter((c) => c.id !== id) }),
  toast: (text, tone = "info") => {
    const id = ++toastId
    set({ toasts: [...get().toasts.slice(-3), { id, text, tone }] })
    setTimeout(() => get().dismiss(id), tone === "error" ? 7000 : 3800)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setSidebar: (open) => set({ sidebarOpen: open }),
}))

/** Credits a generation would cost, for buttons ("Generate · 2 credits"). */
export const creditLabel = (n: number) => (n <= 0 ? "free" : n < 1 ? "<1 credit" : `${Math.ceil(n)} credit${Math.ceil(n) === 1 ? "" : "s"}`)
