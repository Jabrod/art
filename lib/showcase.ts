/**
 * The studio backdrops: what each studio shows behind its title. Every file here is Jabrod's own
 * work, cut from Jabrod's published films (jbd_home public/media/…) with ffmpeg: silent, 432×540,
 * H.264, 4–8 s loops, about 30–75 KB each, with a poster frame. No stock footage.
 */
import type { MediaKind } from "@/lib/board"

export interface ShowcaseItem {
  /** under /studio (public/) */
  src: string
  poster?: string
  /** where it was cut from */
  source: string
}

const ART_FILM = "Introducing Jabrod ART (Jabrod, jbd_home public/media/art/jabrod-art-intro.mp4)"
const JBD_HERO = "JBD hero film (Jabrod, jbd_home public/media/launch/jbd-hero-4k.mp4)"
const JBD_LAUNCH = "JBD launch film (Jabrod, jbd_home public/media/launch/jbd-launch-1080p.mp4)"
const OVERVIEW = "Jabrod overview film (Jabrod, jbd_home public/media/home/jabrod-overview.mp4)"

/** Video Studio: moving loops. */
export const VIDEO_LOOPS: ShowcaseItem[] = [
  { src: "/showcase/art-paint.mp4", poster: "/showcase/art-paint.jpg", source: `${ART_FILM}, 3–11 s, brush painting ART` },
  { src: "/showcase/jbd-editor.mp4", poster: "/showcase/jbd-editor.jpg", source: `${JBD_HERO}, 0–8 s, the editor` },
  { src: "/showcase/jbd-tilt.mp4", poster: "/showcase/jbd-tilt.jpg", source: `${JBD_LAUNCH}, 6–10 s, the editor in 3D` },
  { src: "/showcase/overview-art.mp4", poster: "/showcase/overview-art.jpg", source: `${OVERVIEW}, 4–12 s, Art` },
]

/** Image and Voice Studios: stills (the person's own recent images go first in Image Studio). */
export const STILLS: Record<Exclude<MediaKind, "video">, string[]> = {
  image: ["/brand/sky-hero.webp", "/brand/sky-dusk.webp", "/brand/art-painted.png", "/brand/sky-sea.webp", "/brand/jabrod-art-intro-poster.webp"],
  audio: ["/brand/sky-sea.webp", "/brand/jabrod-art-intro-poster.webp", "/brand/sky-dusk.webp", "/brand/art-underline.png", "/brand/sky-hero.webp"],
}
