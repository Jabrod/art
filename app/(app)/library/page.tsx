"use client"

import { useCallback, useEffect, useState } from "react"
import { Library, Loader2 } from "lucide-react"
import type { MediaKind } from "@/lib/board"
import { useApp } from "@/lib/app-state"
import { store, type LibraryAsset } from "@/lib/store"
import { Lightbox, MediaCard, type CardAsset } from "@/components/studio/MediaCard"

const TABS: { value: MediaKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
]

export default function LibraryPage() {
  const toast = useApp((s) => s.toast)
  const [tab, setTab] = useState<MediaKind | "all">("all")
  const [assets, setAssets] = useState<LibraryAsset[] | null>(null)
  const [more, setMore] = useState(false)
  const [view, setView] = useState<CardAsset | null>(null)

  const load = useCallback(
    async (before?: string) => {
      try {
        const page = await store.listAssets(tab === "all" ? undefined : tab, before)
        setAssets((cur) => (before ? [...(cur ?? []), ...page] : page))
        setMore(page.length === 60)
      } catch (e) {
        setAssets((cur) => cur ?? [])
        toast(e instanceof Error ? e.message : "Couldn't load your Library.", "error")
      }
    },
    [tab, toast],
  )

  useEffect(() => {
    setAssets(null)
    load()
  }, [load])

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="label flex items-center gap-2">
          <Library className="size-3.5" /> Library
        </p>
        <h1 className="font-display mt-3 text-5xl">Everything you've made</h1>
        <p className="mt-3 text-[15px] text-[var(--muted)]">Every image, clip and voiceover you generated or uploaded, across every board.</p>

        <div className="mt-8 flex gap-1.5" role="tablist">
          {TABS.map((t) => (
            <button key={t.value} role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)} className={`chip ${tab === t.value ? "!border-ink/30 !bg-ink/[0.07] !text-ink" : ""}`}>
              {t.label}
            </button>
          ))}
        </div>

        {assets === null ? (
          <p className="mt-10 flex items-center gap-2 text-sm text-[var(--faint)]">
            <Loader2 className="size-4 animate-spin" /> Loading
          </p>
        ) : assets.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[var(--line-strong)] px-6 py-14 text-center text-[14px] text-[var(--muted)]">Nothing here yet. Make something in a studio, or drop files on a board.</div>
        ) : (
          <div className="mt-8 columns-2 gap-3 md:columns-3 lg:columns-4 [&>*]:mb-3 [&>*]:break-inside-avoid">
            {assets.map((a) => (
              <MediaCard key={a.id} asset={a} onOpen={() => setView(a)} />
            ))}
          </div>
        )}
        {more && (
          <div className="mt-6 text-center">
            <button className="btn-ghost" onClick={() => load(assets?.[assets.length - 1]?.createdAt)}>
              Load more
            </button>
          </div>
        )}
      </div>
      <Lightbox asset={view} onClose={() => setView(null)} />
    </div>
  )
}
