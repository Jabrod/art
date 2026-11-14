"use client"

import { usePathname } from "next/navigation"
import type { MediaKind } from "@/lib/board"
import { StudioBackdrop } from "@/components/studio/StudioBackdrop"

/**
 * Image, Video and Voice Studio share this layout, so the backdrop stays mounted while you move
 * between them and crossfades to the next studio's images or loops.
 */
export default function StudiosLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const kind: MediaKind = path.startsWith("/video") ? "video" : path.startsWith("/voice") ? "audio" : "image"
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <StudioBackdrop kind={kind} />
      {children}
    </div>
  )
}
