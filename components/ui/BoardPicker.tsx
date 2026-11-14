"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LayoutGrid, Loader2, Plus } from "lucide-react"
import { useApp } from "@/lib/app-state"
import { addToBoard, type BoardItem } from "@/lib/board-actions"
import { store, type BoardSummary } from "@/lib/store"

/** "Add to board": a small menu of boards (or a new one). Adds the items, then offers to open it. */
export function BoardPicker({ items, label = "Add to board", className = "btn-ghost", align = "left" }: { items: () => BoardItem[]; label?: string; className?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false)
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [below, setBelow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const toast = useApp((s) => s.toast)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    store.listBoards().then(setBoards).catch(() => setBoards([]))
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [open])

  async function add(boardId: string | null) {
    setBusy(true)
    try {
      const id = boardId ?? (await store.createBoard("Untitled board")).id
      const title = await addToBoard(id, items())
      setOpen(false)
      toast(`Added to ${title}.`, "ok")
      if (!boardId) router.push(`/b/${id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't add it to the board.", "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        className={className}
        onClick={() => {
          // open below when there isn't room for the menu above the button
          setBelow((ref.current?.getBoundingClientRect().top ?? 999) < 340)
          setOpen((o) => !o)
        }}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <LayoutGrid className="size-3.5" /> {label}
      </button>
      {open && (
        <div role="menu" className={`rise absolute z-50 w-64 ${below ? "top-full mt-2" : "bottom-full mb-2"} overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-paper-2 p-1.5 shadow-[var(--lift)] ${align === "right" ? "right-0" : "left-0"}`}>
          <button disabled={busy} onClick={() => add(null)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] text-ink hover:bg-ink/[0.06]">
            <Plus className="size-3.5 text-ink/60" /> New board
          </button>
          <div className="my-1 h-px bg-[var(--line)]" />
          <div className="max-h-60 overflow-y-auto scroll-thin">
            {!boards && <p className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--faint)]"><Loader2 className="size-3.5 animate-spin" /> Loading boards</p>}
            {boards?.length === 0 && <p className="px-3 py-2 text-[13px] text-[var(--faint)]">No boards yet.</p>}
            {boards?.map((b) => (
              <button key={b.id} disabled={busy} onClick={() => add(b.id)} className="block w-full truncate rounded-xl px-3 py-2 text-left text-[13px] text-ink/80 hover:bg-ink/[0.06] hover:text-ink">
                {b.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
