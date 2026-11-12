"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUp, Clapperboard, Image as ImageIcon, Loader2, Plus, Sparkles, Square } from "lucide-react"
import { BASE, useApp } from "@/lib/app-state"
import { ArtError, store, type ChatMessage } from "@/lib/store"
import { BoardPicker } from "@/components/ui/BoardPicker"
import { Select } from "@/components/ui/Select"
import { CopyButton, Markdown } from "./Markdown"

const MODEL_KEY = "jabrod-art:chat-model"

const SUGGESTIONS = [
  { icon: ImageIcon, text: "Write three image prompts for a moody coffee brand campaign" },
  { icon: Clapperboard, text: "Storyboard a 20-second product reel for a smartwatch, shot by shot" },
  { icon: Sparkles, text: "Help me name and position a new creative app" },
  { icon: Plus, text: "Explain how diffusion models turn text into images, simply" },
]

interface Props {
  /** An existing chat; none = a new chat that starts on the first message. */
  chatId?: string
  /** Panel mode inside a board: the chat is attached to it, prompts add straight to it. */
  boardId?: string
  compact?: boolean
  onAddPrompt?: (prompt: string) => void
  onChatCreated?: (id: string) => void
}

export function ChatView({ chatId: initialId, boardId, compact, onAddPrompt, onChatCreated }: Props) {
  const router = useRouter()
  const { models, upsertChat, toast, setCredits, loadMe } = useApp()
  const [chatId, setChatId] = useState(initialId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(Boolean(initialId))
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [model, setModel] = useState<string>("")
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const chatModels = models?.chat ?? []

  // Model: the chat's own, else the last one picked, else the default.
  useEffect(() => {
    if (model || chatModels.length === 0) return
    let saved: string | null = null
    try {
      saved = localStorage.getItem(MODEL_KEY)
    } catch {}
    setModel(chatModels.find((m) => m.id === saved)?.id ?? chatModels.find((m) => m.default)?.id ?? chatModels[0].id)
  }, [chatModels, model])

  useEffect(() => {
    setChatId(initialId)
    if (!initialId) {
      setMessages([])
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    store
      .getChat(initialId)
      .then(({ chat, messages }) => {
        if (!live) return
        setMessages(messages)
        setModel(chat.model)
        stickRef.current = true
      })
      .catch((e) => live && toast(e instanceof Error ? e.message : "Couldn't open this chat.", "error"))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [initialId, toast])

  // Keep the newest message in view while the reply streams, unless the person scrolled up.
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const pickModel = (id: string) => {
    setModel(id)
    try {
      localStorage.setItem(MODEL_KEY, id)
    } catch {}
    if (chatId) store.updateChat(chatId, { model: id }).catch(() => undefined)
  }

  const send = useCallback(
    async (textArg?: string) => {
      const text = (textArg ?? input).trim()
      if (!text || streaming) return
      setInput("")
      stickRef.current = true
      let id = chatId
      const now = new Date().toISOString()
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text, createdAt: now }
      const replyId = `a-${Date.now()}`
      setMessages((m) => [...m, userMsg, { id: replyId, role: "assistant", content: "", model, createdAt: now }])
      setStreaming(true)
      try {
        if (!id) {
          const chat = await store.createChat({ model, boardId: boardId ?? null })
          id = chat.id
          setChatId(id)
          upsertChat(chat)
          onChatCreated?.(id)
          // Change the address without remounting this view (the reply is streaming into it).
          if (!compact) window.history.replaceState(null, "", `${BASE}/c/${id}`)
        }
        const controller = new AbortController()
        abortRef.current = controller
        const { title } = await store.sendMessage(
          id,
          text,
          model,
          (delta) => setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: x.content + delta } : x))),
          controller.signal,
        )
        upsertChat({ id, title: title || text.slice(0, 60), model, boardId: boardId ?? null, updatedAt: new Date().toISOString() })
        loadMe()
      } catch (e) {
        const message = e instanceof ArtError || e instanceof Error ? e.message : "The assistant couldn't answer. Try again."
        setMessages((m) => m.filter((x) => !(x.id === replyId && !x.content)))
        toast(message, "error")
        if (e instanceof ArtError && (e.code === "insufficient_credits" || e.code === "pro_required")) {
          loadMe()
          useApp.getState().openPlans(message)
        }
        setInput((cur) => cur || text)
      } finally {
        abortRef.current = null
        setStreaming(false)
        inputRef.current?.focus()
      }
    },
    [input, streaming, chatId, model, boardId, compact, upsertChat, onChatCreated, toast, loadMe],
  )

  const stop = () => abortRef.current?.abort()

  const promptCard = useCallback(
    (prompt: string) => (
      <div className="not-prose relative my-3 rounded-2xl border border-violet/30 bg-violet/[0.06]">
        <div className="flex items-center justify-between border-b border-violet/20 px-3 py-1.5">
          <span className="label !text-[9.5px] !text-violet">Prompt</span>
          <CopyButton text={prompt} />
        </div>
        <p className="whitespace-pre-wrap px-4 py-3 text-[14px] leading-6 text-cream/90">{prompt}</p>
        <div className="flex flex-wrap gap-2 border-t border-violet/15 px-3 py-2">
          {onAddPrompt ? (
            <button className="btn-ghost !h-8" onClick={() => onAddPrompt(prompt)}>
              <Plus className="size-3.5" /> Add to board
            </button>
          ) : (
            <BoardPicker items={() => [{ kind: "prompt", text: prompt }]} className="btn-ghost !h-8" />
          )}
          <button className="btn-ghost !h-8" onClick={() => router.push(`/image?prompt=${encodeURIComponent(prompt)}`)}>
            <ImageIcon className="size-3.5 text-magenta" /> Make image
          </button>
          <button className="btn-ghost !h-8" onClick={() => router.push(`/video?prompt=${encodeURIComponent(prompt)}`)}>
            <Clapperboard className="size-3.5 text-blue" /> Make video
          </button>
        </div>
      </div>
    ),
    [onAddPrompt, router],
  )

  const empty = !loading && messages.length === 0

  const composer = (
    <div className={`mx-auto w-full ${compact ? "" : "max-w-3xl"}`}>
      <div className="rounded-[26px] border border-[var(--line-strong)] bg-ink-3/80 p-2 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl focus-within:border-cream/25">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          rows={compact ? 2 : 3}
          placeholder={compact ? "Ask about this board, or for prompts…" : "Ask anything, or describe what you want to make…"}
          className="max-h-60 w-full resize-none bg-transparent px-3 pt-2 text-[15px] leading-6 text-cream outline-none placeholder:text-[var(--faint)]"
          aria-label="Message"
        />
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2">
            {chatModels.length > 0 && model && (
              <Select
                label="Model"
                value={model}
                onChange={pickModel}
                options={chatModels.map((m) => ({ value: m.id, label: m.label }))}
                icon={<Sparkles className="size-3.5 text-violet" />}
                className="!h-8"
              />
            )}
          </div>
          {streaming ? (
            <button onClick={stop} className="grid size-9 place-items-center rounded-full bg-cream text-ink" aria-label="Stop">
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button onClick={() => send()} disabled={!input.trim() || !model} className="grid size-9 place-items-center rounded-full bg-cream text-ink transition-opacity disabled:opacity-30" aria-label="Send">
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </div>
      {!compact && <p className="mt-2 text-center text-[11px] text-[var(--faint)]">The assistant can be wrong. Check anything important.</p>}
    </div>
  )

  if (empty && !compact) {
    return (
      <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-5 py-10">
        <div className="rise w-full max-w-3xl">
          <p className="label text-center">Jabrod Art Studio</p>
          <h1 className="font-display mt-4 text-center text-4xl sm:text-5xl">
            What are we <span className="paint-text">making</span> today?
          </h1>
          <div className="mt-9">{composer}</div>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button key={s.text} onClick={() => send(s.text)} className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-white/[0.015] px-4 py-3 text-left text-[13.5px] leading-5 text-cream/75 transition-colors hover:border-[var(--line-strong)] hover:bg-white/[0.03] hover:text-cream">
                <s.icon className="mt-0.5 size-4 shrink-0 text-violet" />
                {s.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        <div className={`mx-auto w-full ${compact ? "px-4 py-4" : "max-w-3xl px-5 py-10"}`}>
          {loading && (
            <p className="flex items-center gap-2 text-sm text-[var(--faint)]">
              <Loader2 className="size-4 animate-spin" /> Loading the conversation
            </p>
          )}
          {empty && compact && <p className="text-[13px] leading-6 text-[var(--muted)]">Ask for ideas, a shot list or prompts. Prompts the assistant writes can go straight onto this board.</p>}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={m.id} className="mb-6 flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-white/[0.07] px-4 py-2.5 text-[15px] leading-6 text-cream">{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="group mb-8">
                {m.content ? (
                  <Markdown text={m.content} renderPrompt={promptCard} />
                ) : (
                  <span className="inline-flex gap-1 py-2" aria-label="Thinking">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="size-1.5 animate-pulse rounded-full bg-cream/50 motion-reduce:animate-none" style={{ animationDelay: `${d * 160}ms` }} />
                    ))}
                  </span>
                )}
                {m.content && !(streaming && i === messages.length - 1) && (
                  <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <CopyButton text={m.content} />
                    {m.model && <span className="font-mono text-[10.5px] text-[var(--faint)]">{chatModels.find((x) => x.id === m.model)?.label ?? m.model}</span>}
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      </div>
      <div className={compact ? "border-t border-[var(--line)] p-3" : "px-5 pb-4"}>{composer}</div>
    </div>
  )
}
