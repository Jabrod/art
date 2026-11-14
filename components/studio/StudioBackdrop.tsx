"use client"

/**
 * The band behind each studio's title, kept mounted across Image, Video and Voice Studio so moving
 * between them crossfades instead of reloading. Image and Voice show stills; Video shows short,
 * silent loops of Jabrod's own films (lib/showcase.ts).
 *
 * Loops load only once Video Studio is shown, play only while the band is on screen and the tab is
 * visible, and stay on their poster frames for anyone who prefers reduced motion.
 */
import { useEffect, useRef, useState } from "react"
import type { MediaKind } from "@/lib/board"
import { pub } from "@/lib/app-state"
import { STILLS, VIDEO_LOOPS } from "@/lib/showcase"
import { store } from "@/lib/store"

const KINDS: MediaKind[] = ["image", "video", "audio"]

function useReducedMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)")
    const on = () => setReduce(m.matches)
    on()
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [])
  return reduce
}

export function StudioBackdrop({ kind }: { kind: MediaKind }) {
  const reduce = useReducedMotion()
  const bandRef = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(true)
  const [tabVisible, setTabVisible] = useState(true)
  const [videoSeen, setVideoSeen] = useState(kind === "video")
  const [mine, setMine] = useState<string[]>([])

  useEffect(() => {
    if (kind === "video") setVideoSeen(true)
  }, [kind])

  // The person's own recent images lead the Image Studio band.
  useEffect(() => {
    store
      .listAssets("image")
      .then((a) => setMine(a.slice(0, 5).map((x) => x.url)))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const el = bandRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.05 })
    io.observe(el)
    const vis = () => setTabVisible(document.visibilityState === "visible")
    document.addEventListener("visibilitychange", vis)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", vis)
    }
  }, [])

  const playing = kind === "video" && onScreen && tabVisible && !reduce

  return (
    <div ref={bandRef} className="relative h-[260px] overflow-hidden sm:h-[300px]" aria-hidden>
      {KINDS.map((k) => {
        const active = k === kind
        return (
          <div key={k} className="absolute inset-0 transition-opacity duration-700 ease-out" style={{ opacity: active ? 1 : 0 }}>
            <div className="absolute inset-0 flex -skew-x-6 scale-110 gap-2">
              {k === "video"
                ? VIDEO_LOOPS.map((v) => <Loop key={v.src} src={pub(v.src)} poster={v.poster ? pub(v.poster) : undefined} load={videoSeen} play={playing} />)
                : (k === "image" ? [...mine, ...STILLS.image.map(pub)] : STILLS.audio.map(pub)).slice(0, 5).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src + i} src={src} alt="" loading="lazy" decoding="async" className="h-full min-w-0 flex-1 object-cover opacity-70" />
                  ))}
            </div>
          </div>
        )
      })}
      {/* fade into the page */}
      <div className="absolute inset-0 bg-gradient-to-b from-paper/30 via-paper/70 to-paper" />
    </div>
  )
}

function Loop({ src, poster, load, play }: { src: string; poster?: string; load: boolean; play: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (play) v.play().catch(() => undefined)
    else v.pause()
  }, [play, load])
  return (
    <video
      ref={ref}
      src={load ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      preload={load ? "auto" : "none"}
      className="h-full min-w-0 flex-1 object-cover opacity-80"
    />
  )
}
