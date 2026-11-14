"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LayoutGrid, Loader2, Plus, Trash2 } from "lucide-react"
import { pub, useApp } from "@/lib/app-state"
import { store, type BoardSummary } from "@/lib/store"

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

export default function BoardsPage() {
  const router = useRouter()
  const toast = useApp((s) => s.toast)
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    store.listBoards().then(setBoards).catch((e) => {
      setBoards([])
      toast(e instanceof Error ? e.message : "Couldn't load your boards.", "error")
    })
  }, [toast])

  async function create() {
    setCreating(true)
    try {
      const b = await store.createBoard("Untitled board")
      router.push(`/b/${b.id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't make a board.", "error")
      setCreating(false)
    }
  }

  async function remove(b: BoardSummary) {
    if (!confirm(`Delete "${b.title}"? The board is deleted; its files stay in your Library.`)) return
    try {
      await store.deleteBoard(b.id)
      setBoards((cur) => cur?.filter((x) => x.id !== b.id) ?? null)
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete the board.", "error")
    }
  }

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label flex items-center gap-2 !text-ink/60">
              <LayoutGrid className="size-3.5" /> Canvas
            </p>
            <h1 className="font-display mt-3 text-5xl">Boards</h1>
            <p className="mt-3 max-w-lg text-[15px] leading-7 text-[var(--muted)]">An infinite canvas for each project. Connect prompts to images, video and voice, then take it all to JBD.</p>
          </div>
          <button className="btn-primary" onClick={create} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New board
          </button>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button onClick={create} disabled={creating} className="group grid aspect-[16/10] place-items-center rounded-3xl border border-dashed border-[var(--line-strong)] text-[var(--muted)] transition-colors hover:border-ink/30 hover:text-ink">
            <span className="flex flex-col items-center gap-2 text-[14px]">
              <span className="grid size-11 place-items-center rounded-full bg-ink/[0.05] transition-colors group-hover:bg-ink/[0.09]">
                <Plus className="size-5" />
              </span>
              New board
            </span>
          </button>
          {boards === null &&
            [0, 1].map((i) => <div key={i} className="aspect-[16/10] animate-pulse rounded-3xl bg-ink/[0.03] motion-reduce:animate-none" />)}
          {boards?.map((b) => (
            <div key={b.id} className="group relative">
              <Link href={`/b/${b.id}`} className="block overflow-hidden rounded-3xl border border-[var(--line)] bg-paper-2 transition-colors hover:border-[var(--line-strong)]">
                <div className="relative aspect-[16/10] overflow-hidden bg-paper-3">
                  {b.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pub("/brand/art-underline.png")} alt="" className="absolute left-1/2 top-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 opacity-40" />
                  )}
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="truncate text-[14px] text-ink">{b.title}</p>
                  <span className="shrink-0 font-mono text-[11px] text-[var(--faint)]">{ago(b.updatedAt)}</span>
                </div>
              </Link>
              <button onClick={() => remove(b)} className="icon-btn absolute right-3 top-3 bg-paper-2 opacity-0 shadow-[var(--lift)] transition-opacity hover:!text-ink/60 focus:opacity-100 group-hover:opacity-100" aria-label={`Delete ${b.title}`}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
