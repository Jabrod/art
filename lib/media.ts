"use client"

import { useEffect, useState } from "react"
import { kindForMime, type AssetRef } from "@/lib/board"
import { store, type UploadInfo } from "@/lib/store"

/** Size and length of a media file, read in the browser before it uploads. */
export async function probeFile(file: File): Promise<UploadInfo> {
  const kind = kindForMime(file.type)
  if (!kind) throw new Error("unsupported")
  const url = URL.createObjectURL(file)
  try {
    if (kind === "image") {
      const img = new Image()
      img.src = url
      await img.decode().catch(() => undefined)
      return { kind, width: img.naturalWidth || undefined, height: img.naturalHeight || undefined }
    }
    const el = document.createElement(kind === "video" ? "video" : "audio")
    el.preload = "metadata"
    el.src = url
    await new Promise<void>((resolve) => {
      el.onloadedmetadata = () => resolve()
      el.onerror = () => resolve()
      setTimeout(resolve, 5000)
    })
    const v = el as HTMLVideoElement
    return {
      kind,
      width: kind === "video" ? v.videoWidth || undefined : undefined,
      height: kind === "video" ? v.videoHeight || undefined : undefined,
      durationMs: Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : undefined,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** The playable URL of an asset (local-mode files resolve to object URLs). */
export function useAssetUrl(asset: AssetRef | undefined) {
  const [url, setUrl] = useState<string | null>(asset && !asset.url.startsWith("idb:") ? asset.url : null)
  useEffect(() => {
    if (!asset) return setUrl(null)
    if (!asset.url.startsWith("idb:")) return setUrl(asset.url)
    let live = true
    store.resolveUrl(asset).then((u) => live && setUrl(u)).catch(() => live && setUrl(null))
    return () => {
      live = false
    }
  }, [asset])
  return url
}

export const fmtDuration = (ms?: number) => {
  if (!ms && ms !== 0) return ""
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** Saves a remote file under its name (fetch → blob, so cross-origin files keep their name). */
export async function downloadAsset(asset: AssetRef) {
  const url = asset.url.startsWith("idb:") ? await store.resolveUrl(asset) : asset.url
  try {
    const blob = await (await fetch(url)).blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = href
    a.download = asset.name || `jabrod-art-${asset.id}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(href), 10_000)
  } catch {
    window.open(url, "_blank", "noopener")
  }
}
