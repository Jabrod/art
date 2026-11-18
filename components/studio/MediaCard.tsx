"use client"

import { memo } from "react"
import { Download, Maximize2, RotateCcw, Scissors } from "lucide-react"
import { editorHref } from "@/lib/editor"
import type { AssetRef } from "@/lib/board"
import { downloadAsset, fmtDuration, useAssetUrl } from "@/lib/media"
import { BoardPicker } from "@/components/ui/BoardPicker"

export interface CardAsset extends AssetRef {
  prompt?: string
}

/** One result in a studio or the Library: the media, and its actions on hover/focus. */
export const MediaCard = memo(function MediaCard({ asset, onOpen, onReuse }: { asset: CardAsset; onOpen?: () => void; onReuse?: (prompt: string) => void }) {
  const url = useAssetUrl(asset)
  const ratio = asset.width && asset.height ? `${asset.width} / ${asset.height}` : asset.kind === "video" ? "16 / 9" : asset.kind === "audio" ? "auto" : "1 / 1"
  return (
    <figure className="group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-paper-2">
      {asset.kind === "audio" ? (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="label !text-ink/60">Audio</span>
            <span className="font-mono text-[11px] text-[var(--faint)]">{fmtDuration(asset.durationMs)}</span>
          </div>
          {asset.prompt && <p className="line-clamp-3 text-[13.5px] leading-5 text-ink/80">{asset.prompt}</p>}
          {url && <audio src={url} controls preload="metadata" className="h-9 w-full" />}
        </div>
      ) : (
        <div className="relative w-full" style={{ aspectRatio: ratio }}>
          {url &&
            (asset.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={asset.prompt ?? asset.name ?? "Generated image"} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <video src={url} controls preload="metadata" playsInline className="absolute inset-0 h-full w-full bg-black object-contain" />
            ))}
        </div>
      )}
      <figcaption className={`flex items-center gap-1.5 p-2 ${asset.kind === "audio" ? "border-t border-[var(--line)]" : "absolute inset-x-0 top-0 justify-end bg-gradient-to-b from-black/60 to-transparent opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"}`}>
        {asset.kind === "audio" && <span className="mr-auto truncate text-[11.5px] text-[var(--faint)]">{asset.name}</span>}
        {asset.prompt && onReuse && (
          <button className="icon-btn bg-black/40 backdrop-blur" title="Use this prompt" aria-label="Use this prompt" onClick={() => onReuse(asset.prompt!)}>
            <RotateCcw className="size-3.5" />
          </button>
        )}
        {onOpen && asset.kind === "image" && (
          <button className="icon-btn bg-black/40 backdrop-blur" title="View" aria-label="View" onClick={onOpen}>
            <Maximize2 className="size-3.5" />
          </button>
        )}
        {asset.kind !== "image" && !asset.url.startsWith("idb:") && (
          <a className="icon-btn bg-black/40 backdrop-blur" title="Open in Editor" aria-label="Open in Editor" href={editorHref(asset)}>
            <Scissors className="size-3.5" />
          </a>
        )}
        <button className="icon-btn bg-black/40 backdrop-blur" title="Download" aria-label="Download" onClick={() => downloadAsset(asset)}>
          <Download className="size-3.5" />
        </button>
        <BoardPicker items={() => [{ asset, prompt: asset.prompt }]} label="" className="icon-btn bg-black/40 backdrop-blur" align="right" />
      </figcaption>
    </figure>
  )
})

export function Lightbox({ asset, onClose }: { asset: CardAsset | null; onClose: () => void }) {
  const url = useAssetUrl(asset ?? undefined)
  if (!asset) return null
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/70 p-6 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="Image preview" onKeyDown={(e) => e.key === "Escape" && onClose()} tabIndex={-1}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={asset.prompt ?? ""} className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" />
      )}
      {asset.prompt && <p className="absolute bottom-6 left-1/2 max-w-2xl -translate-x-1/2 rounded-2xl bg-black/60 px-4 py-2 text-center text-[13px] leading-5 text-ink/85">{asset.prompt}</p>}
    </div>
  )
}
