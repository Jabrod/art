"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type Viewport } from "@xyflow/react"
import { ArrowLeft, AudioLines, Check, Clapperboard, CloudOff, FileDown, Image as ImageIcon, Loader2, MessageSquare, NotebookPen, Redo2, Sparkles, Undo2, Upload, X } from "lucide-react"
import { FRAME, type NodeKind } from "@/lib/board"
import { useApp } from "@/lib/app-state"
import { addFiles, pollVideos } from "@/lib/generate"
import { makeNode } from "@/lib/nodes"
import { useBoard } from "@/lib/useBoard"
import { store } from "@/lib/store"
import { ChatView } from "@/components/chat/ChatView"
import { Inspector } from "./Inspector"
import { nodeTypes } from "./nodes"

const PALETTE: { kind: NodeKind; label: string; key: string; icon: typeof ImageIcon; color: string }[] = [
  { kind: "prompt", label: "Prompt", key: "P", icon: Sparkles, color: "text-violet" },
  { kind: "image", label: "Image", key: "I", icon: ImageIcon, color: "text-magenta" },
  { kind: "video", label: "Video", key: "V", icon: Clapperboard, color: "text-blue" },
  { kind: "audio", label: "Audio", key: "A", icon: AudioLines, color: "text-coral" },
  { kind: "note", label: "Note", key: "N", icon: NotebookPen, color: "text-cream/80" },
  { kind: "export", label: "Export", key: "E", icon: FileDown, color: "text-mint" },
]

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))

export function Canvas({ boardId }: { boardId: string }) {
  return (
    <ReactFlowProvider>
      <Board boardId={boardId} />
    </ReactFlowProvider>
  )
}

function Board({ boardId }: { boardId: string }) {
  const s = useBoard()
  const { toast } = useApp()
  const flow = useReactFlow()
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; flow: { x: number; y: number } } | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatId, setChatId] = useState<string | undefined>()
  const [dragOver, setDragOver] = useState(false)
  const reduceMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, [])

  useEffect(() => {
    s.load(boardId)
    return () => useBoard.getState().reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId])

  // Surface a reload after a conflict.
  useEffect(() => {
    if (s.error && s.nodes.length > 0) toast(s.error, "info")
  }, [s.error, s.nodes.length, toast])

  // Video jobs on this board: check every 5 s.
  useEffect(() => {
    const t = setInterval(pollVideos, 5000)
    return () => clearInterval(t)
  }, [])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (useBoard.getState().save !== "saved") e.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [])

  // The board's latest assistant chat, if any.
  useEffect(() => {
    if (!chatOpen || chatId) return
    store.listChats({ boardId }).then((c) => c[0] && setChatId(c[0].id)).catch(() => undefined)
  }, [chatOpen, chatId, boardId])

  const center = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }, [flow])

  const add = useCallback(
    (kind: NodeKind, at?: { x: number; y: number }) => {
      const p = at ?? center()
      const f = FRAME[kind]
      // a little offset when several are added at the centre, so they don't stack exactly
      const jitter = at ? 0 : (useBoard.getState().nodes.length % 5) * 24
      s.addNode(kind, { x: p.x - f.width / 2 + jitter, y: p.y - f.height / 2 + jitter })
    },
    [center, s],
  )

  // Keyboard: P I V A N E add nodes, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, Ctrl+D duplicate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) useBoard.getState().redo()
        else useBoard.getState().undo()
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault()
        useBoard.getState().redo()
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault()
        useBoard.getState().duplicateSelected()
      } else if (!mod && !e.altKey) {
        const item = PALETTE.find((p) => p.key.toLowerCase() === e.key.toLowerCase())
        if (item) add(item.kind)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [add])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) addFiles(files, flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }))
  }

  // Paste images straight onto the board.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return
      const files = Array.from(e.clipboardData?.files ?? [])
      if (files.length) {
        e.preventDefault()
        addFiles(files, center())
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [center])

  const addPromptFromChat = useCallback(
    (text: string) => {
      const p = center()
      useBoard.getState().addNode("prompt", { x: p.x - 140, y: p.y - 88 }, { text })
      toast("Prompt added to the board. Connect it to an image, video or audio node.", "ok")
    },
    [center, toast],
  )

  const working = new Set(s.nodes.filter((n) => n.data.status === "working").map((n) => n.id))
  const edges = working.size === 0 ? s.edges : s.edges.map((e) => (working.has(e.target) ? { ...e, animated: !reduceMotion, style: { stroke: "#a24bff", strokeWidth: 2 } } : e))

  if (!s.loaded) {
    return (
      <div className="grid h-full place-items-center text-sm text-[var(--faint)]">
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Opening the board
        </span>
      </div>
    )
  }
  if (s.error && s.nodes.length === 0 && !s.boardId) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <p className="text-[15px] text-cream/85">{s.error}</p>
          <Link href="/boards" className="btn-ghost mt-5">
            Back to boards
          </Link>
        </div>
      </div>
    )
  }

  const selected = s.nodes.filter((n) => n.selected)

  return (
    <div className="flex h-full">
      <div
        ref={wrapRef}
        className="relative min-w-0 flex-1"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault()
            setDragOver(true)
          }
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setDragOver(false)}
        onDrop={onDrop}
      >
        <ReactFlow
          nodes={s.nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={s.onNodesChange}
          onEdgesChange={s.onEdgesChange}
          onConnect={s.connect}
          onNodeDragStart={() => s.checkpoint()}
          defaultViewport={s.viewport}
          onMoveEnd={(_, v: Viewport) => s.setViewport(v)}
          onPaneContextMenu={(e) => {
            e.preventDefault()
            setMenu({ x: e.clientX, y: e.clientY, flow: flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }) })
          }}
          onPaneClick={() => setMenu(null)}
          defaultEdgeOptions={{ type: "default", animated: false }}
          connectionRadius={28}
          minZoom={0.08}
          maxZoom={3}
          panActivationKeyCode="Space"
          deleteKeyCode={["Delete", "Backspace"]}
          multiSelectionKeyCode={["Shift", "Meta", "Control"]}
          selectionKeyCode="Shift"
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
          fitView={s.nodes.length > 0 && s.viewport.x === 0 && s.viewport.y === 0 && s.viewport.zoom === 1}
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          className={dragOver ? "outline outline-2 -outline-offset-8 outline-violet/60" : ""}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="rgba(243,238,226,0.13)" />
          <MiniMap pannable zoomable nodeStrokeWidth={0} nodeBorderRadius={6} nodeColor={(n) => ({ prompt: "#a24bff", image: "#ff3d8b", video: "#3f7dff", audio: "#ff8a3d", note: "#6b6670", export: "#34d399" })[n.type as NodeKind] ?? "#555"} position="bottom-right" style={{ width: 168, height: 112 }} />
          <Controls position="bottom-left" showInteractive={false} fitViewOptions={{ padding: 0.25, duration: reduceMotion ? 0 : 300 }} style={{ marginLeft: 72 }} />
        </ReactFlow>

        <TopBar onToggleChat={() => setChatOpen((o) => !o)} chatOpen={chatOpen} onUpload={() => fileRef.current?.click()} />

        {/* Palette */}
        <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-[var(--line)] bg-ink-2/90 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl" role="toolbar" aria-label="Add to board">
          {PALETTE.map((p) => (
            <button key={p.kind} onClick={() => add(p.kind)} className="group relative grid size-10 place-items-center rounded-xl text-cream/70 hover:bg-white/[0.07] hover:text-cream" aria-label={`Add ${p.label} (${p.key})`}>
              <p.icon className={`size-[18px] ${p.color}`} />
              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-lg bg-ink-3 px-2 py-1 text-[11.5px] text-cream opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {p.label} <span className="font-mono text-[var(--faint)]">{p.key}</span>
              </span>
            </button>
          ))}
          <div className="mx-2 my-1 h-px bg-[var(--line)]" />
          <button onClick={() => fileRef.current?.click()} className="grid size-10 place-items-center rounded-xl text-cream/70 hover:bg-white/[0.07] hover:text-cream" aria-label="Upload files" title="Upload (or drop files on the board)">
            <Upload className="size-[18px]" />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept="image/*,video/mp4,video/webm,video/quicktime,audio/*"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) addFiles(files, center())
            e.target.value = ""
          }}
        />

        {s.nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="rise text-center">
              <p className="label">Empty board</p>
              <p className="font-display mt-3 text-3xl text-cream/90">Start with an idea.</p>
              <p className="mt-3 text-[14px] leading-6 text-[var(--muted)]">
                Add a Prompt (P) and an Image (I), connect them, and press Generate.
                <br />
                Or drop images, clips and audio anywhere on the board.
              </p>
              <div className="pointer-events-auto mt-6 flex justify-center gap-2">
                <button
                  className="btn-primary"
                  onClick={() => {
                    const p = center()
                    const prompt = makeNode("prompt", { x: p.x - 330, y: p.y - 88 }, { text: "" })
                    const image = makeNode("image", { x: p.x + 30, y: p.y - 200 })
                    useBoard.getState().addNodes([{ ...prompt }, image], [{ id: `e-${prompt.id}`, source: prompt.id, target: image.id }])
                  }}
                >
                  <Sparkles className="size-4" /> Prompt → Image
                </button>
                <button className="btn-ghost !h-10" onClick={() => setChatOpen(true)}>
                  <MessageSquare className="size-4" /> Ask the assistant
                </button>
              </div>
            </div>
          </div>
        )}

        {menu && (
          <div className="rise fixed z-50 w-48 rounded-2xl border border-[var(--line-strong)] bg-ink-3 p-1.5 shadow-[0_16px_50px_rgba(0,0,0,0.6)]" style={{ left: menu.x, top: menu.y }} role="menu">
            {PALETTE.map((p) => (
              <button
                key={p.kind}
                onClick={() => {
                  add(p.kind, { x: menu.flow.x + FRAME[p.kind].width / 2, y: menu.flow.y + FRAME[p.kind].height / 2 })
                  setMenu(null)
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-cream/85 hover:bg-white/[0.06]"
              >
                <p.icon className={`size-4 ${p.color}`} /> {p.label}
                <span className="ml-auto font-mono text-[11px] text-[var(--faint)]">{p.key}</span>
              </button>
            ))}
          </div>
        )}

        {selected.length === 1 && <Inspector node={selected[0]} />}
      </div>

      {chatOpen && (
        <aside className="flex w-[380px] shrink-0 flex-col border-l border-[var(--line)] bg-ink-2">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--line)] px-4">
            <span className="flex items-center gap-2 text-[13px] text-cream/85">
              <MessageSquare className="size-4 text-violet" /> Assistant
            </span>
            <div className="flex items-center">
              {chatId && (
                <button className="btn-ghost !h-7 !px-2.5 !text-[11.5px]" onClick={() => setChatId(undefined)}>
                  New
                </button>
              )}
              <button className="icon-btn" onClick={() => setChatOpen(false)} aria-label="Close assistant">
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ChatView key={chatId ?? "new"} chatId={chatId} boardId={boardId} compact onAddPrompt={addPromptFromChat} onChatCreated={setChatId} />
          </div>
        </aside>
      )}
    </div>
  )
}

function TopBar({ onToggleChat, chatOpen, onUpload }: { onToggleChat: () => void; chatOpen: boolean; onUpload: () => void }) {
  const title = useBoard((s) => s.title)
  const save = useBoard((s) => s.save)
  const canUndo = useBoard((s) => s.past.length > 0)
  const canRedo = useBoard((s) => s.future.length > 0)
  const credits = useApp((s) => s.me?.credits)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-3">
      <div className="pointer-events-auto flex h-11 items-center gap-1 rounded-2xl border border-[var(--line)] bg-ink-2/90 pl-1.5 pr-3 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <Link href="/boards" className="icon-btn" aria-label="All boards">
          <ArrowLeft className="size-4" />
        </Link>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false)
              const t = draft.trim()
              if (t && t !== title) useBoard.getState().setTitle(t.slice(0, 120))
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              if (e.key === "Escape") {
                setDraft(title)
                setEditing(false)
              }
            }}
            className="field h-8 w-56 text-[14px]"
            aria-label="Board name"
          />
        ) : (
          <button
            onClick={() => {
              setDraft(title)
              setEditing(true)
            }}
            className="max-w-[260px] truncate rounded-lg px-2 py-1 text-[14px] font-medium text-cream hover:bg-white/[0.05]"
            title="Rename"
          >
            {title}
          </button>
        )}
        <span className="ml-1 flex items-center gap-1 font-mono text-[10.5px] text-[var(--faint)]" aria-live="polite">
          {save === "saving" && <Loader2 className="size-3 animate-spin" />}
          {save === "saved" && <Check className="size-3 text-mint" />}
          {save === "error" && <CloudOff className="size-3 text-magenta" />}
          {save === "saved" ? "Saved" : save === "saving" ? "Saving" : save === "dirty" ? "Edited" : "Not saved — retrying"}
        </span>
        <div className="mx-1 h-5 w-px bg-[var(--line)]" />
        <button className="icon-btn" onClick={() => useBoard.getState().undo()} disabled={!canUndo} aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)">
          <Undo2 className="size-4" />
        </button>
        <button className="icon-btn" onClick={() => useBoard.getState().redo()} disabled={!canRedo} aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)">
          <Redo2 className="size-4" />
        </button>
      </div>
      <div className="pointer-events-auto flex h-11 items-center gap-2 rounded-2xl border border-[var(--line)] bg-ink-2/90 px-2 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {credits && store.mode === "remote" && (
          <span className="px-2 font-mono text-[11px] text-[var(--muted)]" title="AI credits left this month">
            <Sparkles className="mr-1 inline size-3 text-violet" />
            {credits.left} credits
          </span>
        )}
        <button className="btn-ghost !h-8" onClick={onUpload}>
          <Upload className="size-3.5" /> Upload
        </button>
        <button className={`btn-ghost !h-8 ${chatOpen ? "!border-violet/50 bg-violet/10" : ""}`} onClick={onToggleChat} aria-pressed={chatOpen}>
          <MessageSquare className="size-3.5 text-violet" /> Assistant
        </button>
      </div>
    </div>
  )
}
