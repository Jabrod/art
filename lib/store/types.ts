import type { AssetRef, BoardDoc, MediaKind } from "@/lib/board"

/** A failure the studio shows to the person as it is (message is written for them). */
export class ArtError extends Error {
  constructor(
    message: string,
    public code = "error",
    public status = 0,
  ) {
    super(message)
  }
}

export interface Me {
  signedIn: boolean
  user?: { name: string; email: string }
  /** Credits this month: Art's free allowance, plus JBD Pro's pool for Pro members. */
  credits?: { used: number; limit: number; left: number; pro: boolean }
  /** Whether this person has JBD signed in on a computer (Open JBD vs Download JBD). */
  jbd?: { hasDevice: boolean }
  /** Where to send a signed-out person (returns to the studio afterwards). */
  signInUrl?: string
}

export interface BoardSummary {
  id: string
  title: string
  updatedAt: string
  thumbnailUrl?: string | null
}

export interface Board {
  id: string
  title: string
  doc: BoardDoc
  updatedAt: string
}

export type SaveResult = { updatedAt: string } | { conflict: true }

export interface ImageModel {
  id: string
  label: string
  vendor: string
  credits: number
  aspects: string[]
  default?: boolean
}

export interface VideoModel {
  id: string
  label: string
  vendor: string
  durations: number[]
  resolutions: string[]
  aspects: string[]
  audio: boolean
  /** credits for one second, by resolution, silent and with audio */
  creditsPerSecond: Record<string, number>
  audioCreditsPerSecond: Record<string, number>
  default?: boolean
}

export interface VoiceModel {
  id: string
  label: string
  voices: string[]
  /** credits for 1,000 characters */
  creditsPer1k: number
  default?: boolean
}

export interface ChatModel {
  id: string
  label: string
  vendor: string
  tier: "fast" | "smart"
  default?: boolean
}

export interface Models {
  chat: ChatModel[]
  image: ImageModel[]
  video: VideoModel[]
  voice: VoiceModel[]
}

export interface ImageRequest {
  boardId?: string | null
  prompt: string
  model: string
  aspect: string
  count?: number
}
export interface SpeechRequest {
  boardId?: string | null
  text: string
  model: string
  voice?: string
}
export interface VideoRequest {
  boardId?: string | null
  prompt: string
  model: string
  seconds: number
  aspect: string
  resolution: string
  audio: boolean
}

export type Credits = { used: number; limit: number; left: number }

export type VideoStatus = { status: "pending" } | { status: "done"; asset: AssetRef } | { status: "error"; error: string }

/** A file in the Library (everything uploaded or generated). */
export interface LibraryAsset extends AssetRef {
  source: "upload" | "generated"
  prompt?: string
  model?: string
  boardId?: string
  createdAt: string
}

export interface Chat {
  id: string
  title: string
  model: string
  boardId: string | null
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  model?: string | null
  createdAt: string
}

export type Currency = "INR" | "USD"
export type Interval = "month" | "year"

/** Art Pro prices in minor units (paise / cents). The server's answer wins when it has one. */
export const ART_PRO_PRICES: Record<Currency, Record<Interval, number>> = {
  INR: { month: 99900, year: 799900 },
  USD: { month: 1200, year: 9600 },
}

/** The person's plan and what they can buy (GET /api/art/billing). */
export interface Billing {
  /** the currency to show first (by country) */
  currency: Currency
  prices: Record<Currency, Record<Interval, number>>
  /** whether checkout is set up for each currency and interval in this payment mode */
  available: Record<Currency, Record<Interval, boolean>>
  mode: "test" | "live"
  plan: {
    pro: boolean
    /** when Pro ends (ISO), if it does */
    until: string | null
    subscribed: boolean
    status: string | null
    interval: Interval | null
    nextBillingAt: string | null
  }
}

export interface UploadInfo {
  kind: MediaKind
  width?: number
  height?: number
  durationMs?: number
}

/**
 * Everything the studio needs from a backend. `remote` is jabrod.com (art.jabrod.com/api/art);
 * `local` keeps boards in this browser for running the studio with no account.
 */
export interface BoardStore {
  mode: "remote" | "local"
  me(): Promise<Me>
  models(): Promise<Models>
  listBoards(): Promise<BoardSummary[]>
  createBoard(title: string): Promise<Board>
  getBoard(id: string): Promise<Board>
  saveBoard(id: string, change: { title?: string; doc?: BoardDoc; thumbnail?: string | null }, updatedAt: string): Promise<SaveResult>
  deleteBoard(id: string): Promise<void>
  upload(file: File, boardId: string | null, info: UploadInfo, onProgress?: (fraction: number) => void): Promise<AssetRef>
  /** A URL the browser can play or show (remote URLs as they are; local blobs as object URLs). */
  resolveUrl(asset: AssetRef): Promise<string>
  generateImage(req: ImageRequest): Promise<{ assets: AssetRef[]; credits: Credits }>
  generateSpeech(req: SpeechRequest): Promise<{ asset: AssetRef; credits: Credits }>
  startVideo(req: VideoRequest): Promise<{ job: string; credits: Credits }>
  videoStatus(job: string, boardId: string | null, prompt?: string): Promise<VideoStatus>
  listAssets(kind?: MediaKind, before?: string): Promise<LibraryAsset[]>
  /** The plan and prices, or null where billing isn't available (local mode, older backend). */
  billing(): Promise<Billing | null>
  /** A Dodo checkout session for Art Pro that returns to `returnPath` (a /studio path). */
  startCheckout(interval: Interval, currency: Currency, returnPath: string): Promise<{ checkoutUrl: string }>
  /** Applies a finished checkout (the subscription id Dodo adds to the return URL). */
  syncCheckout(subscriptionId: string): Promise<{ status: string | null }>
  /** Dodo's customer portal: payment method, invoices, cancel. */
  billingPortal(): Promise<{ url: string }>
  listChats(opts?: { q?: string; boardId?: string }): Promise<Chat[]>
  createChat(opts: { model?: string; boardId?: string | null }): Promise<Chat>
  getChat(id: string): Promise<{ chat: Chat; messages: ChatMessage[] }>
  updateChat(id: string, change: { title?: string; model?: string }): Promise<Chat>
  deleteChat(id: string): Promise<void>
  /** Sends a message and streams the reply into onDelta. Resolves with the chat's title. */
  sendMessage(chatId: string, content: string, model: string, onDelta: (text: string) => void, signal?: AbortSignal): Promise<{ title: string }>
}
