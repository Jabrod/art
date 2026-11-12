"use client"

/**
 * Image, Video and Voice Studio: one page shape. A hero, a prompt box with the kind's controls and
 * its cost, and everything you've made of that kind below (newest first), each with download and
 * "Add to board". Video jobs keep running if you leave; they're remembered in this browser and
 * picked up again when you come back.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowUp, AudioLines, Clock, Image as ImageIcon, Layers, Loader2, Mic, Monitor, RectangleHorizontal, Sparkles, Volume2, VolumeX } from "lucide-react"
import type { MediaKind } from "@/lib/board"
import { creditLabel, pub, useApp } from "@/lib/app-state"
import { ArtError, store, type LibraryAsset } from "@/lib/store"
import { Select } from "@/components/ui/Select"
import { Lightbox, MediaCard, type CardAsset } from "./MediaCard"

const COPY: Record<MediaKind, { title: string; line: string; placeholder: string; color: string; icon: typeof ImageIcon }> = {
  image: { title: "Image Studio", line: "Make images that stop the scroll.", placeholder: "A cinematic portrait at golden hour, 85mm, soft rim light", color: "text-magenta", icon: ImageIcon },
  video: { title: "Video Studio", line: "Turn an idea into a moving shot.", placeholder: "Slow dolly-in on a ceramic mug steaming on a rainy windowsill, 35mm film look", color: "text-blue", icon: Monitor },
  audio: { title: "Voice Studio", line: "Give your story a voice.", placeholder: "Write the words to speak. Every great story starts with a single frame…", color: "text-coral", icon: AudioLines },
}

const HERO = ["/brand/sky-hero.webp", "/brand/jabrod-art-intro-poster.webp", "/brand/sky-dusk.webp", "/brand/art-painted.png", "/brand/sky-sea.webp"]

const JOBS_KEY = "jabrod-art:video-jobs"
interface PendingJob {
  job: string
  prompt: string
  aspect: string
  at: number
}
const readJobs = (): PendingJob[] => {
  try {
    return JSON.parse(localStorage.getItem(JOBS_KEY) ?? "[]")
  } catch {
    return []
  }
}
const writeJobs = (jobs: PendingJob[]) => {
  try {
    localStorage.setItem(JOBS_KEY, JSON.stringify(jobs))
  } catch {}
}

export function StudioPage({ kind }: { kind: MediaKind }) {
  const params = useSearchParams()
  const { models, toast, setCredits, loadMe } = useApp()
  const copy = COPY[kind]
  const [prompt, setPrompt] = useState(params.get("prompt") ?? "")
  const [assets, setAssets] = useState<LibraryAsset[] | null>(null)
  const [pending, setPending] = useState<{ id: string; aspect: string }[]>([])
  const [jobs, setJobs] = useState<PendingJob[]>([])
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<CardAsset | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // image
  const [imageModel, setImageModel] = useState("auto")
  const [aspect, setAspect] = useState(kind === "video" ? "16:9" : "1:1")
  const [count, setCount] = useState("1")
  // video
  const [videoModel, setVideoModel] = useState("")
  const [seconds, setSeconds] = useState("")
  const [resolution, setResolution] = useState("")
  const [withAudio, setWithAudio] = useState(false)
  // voice
  const [voiceModel, setVoiceModel] = useState("")
  const [voice, setVoice] = useState("")

  const vm = models?.video.find((m) => m.id === videoModel) ?? models?.video.find((m) => m.default) ?? models?.video[0]
  const sm = models?.voice.find((m) => m.id === voiceModel) ?? models?.voice.find((m) => m.default) ?? models?.voice[0]
  const im = imageModel === "auto" ? (models?.image.find((m) => m.default) ?? models?.image[0]) : models?.image.find((m) => m.id === imageModel)

  // Sensible video settings for the chosen model.
  useEffect(() => {
    if (!vm) return
    if (!vm.durations.includes(Number(seconds))) setSeconds(String(vm.durations.includes(5) ? 5 : vm.durations[0]))
    if (!vm.resolutions.includes(resolution)) setResolution(vm.resolutions.includes("720p") ? "720p" : vm.resolutions[0])
    if (kind === "video" && !vm.aspects.includes(aspect)) setAspect(vm.aspects[0])
    if (!vm.audio) setWithAudio(false)
  }, [vm, seconds, resolution, aspect, kind])
  useEffect(() => {
    if (sm && !sm.voices.includes(voice)) setVoice(sm.voices[0] ?? "")
  }, [sm, voice])

  const cost = useMemo(() => {
    if (kind === "image") return (im?.credits ?? 0) * Number(count)
    if (kind === "video" && vm) {
      const per = (withAudio ? vm.audioCreditsPerSecond : vm.creditsPerSecond)[resolution] ?? vm.creditsPerSecond[resolution] ?? 0
      return per * Number(seconds || 0)
    }
    if (kind === "audio" && sm) return Math.max(1, (sm.creditsPer1k * [...prompt].length) / 1000)
    return 0
  }, [kind, im, count, vm, withAudio, resolution, seconds, sm, prompt])

  const load = useCallback(() => {
    store.listAssets(kind).then(setAssets).catch(() => setAssets([]))
  }, [kind])
  useEffect(load, [load])

  // Video jobs: resume the ones started earlier, poll every 5 s.
  useEffect(() => {
    if (kind === "video") setJobs(readJobs().filter((j) => Date.now() - j.at < 2 * 3600 * 1000))
  }, [kind])
  useEffect(() => {
    if (kind !== "video" || jobs.length === 0) return
    let live = true
    const tick = async () => {
      for (const j of jobs) {
        try {
          const s = await store.videoStatus(j.job, null, j.prompt)
          if (!live) return
          if (s.status === "pending") continue
          setJobs((cur) => {
            const next = cur.filter((x) => x.job !== j.job)
            writeJobs(next)
            return next
          })
          if (s.status === "done") {
            setAssets((cur) => [{ ...s.asset, source: "generated", prompt: j.prompt, createdAt: new Date().toISOString() }, ...(cur ?? [])])
            toast("Your clip is ready.", "ok")
          } else {
            toast(s.error, "error")
            loadMe()
          }
        } catch {
          // try again next tick
        }
      }
    }
    const t = setInterval(tick, 5000)
    tick()
    return () => {
      live = false
      clearInterval(t)
    }
  }, [kind, jobs, toast, loadMe])

  async function generate() {
    const text = prompt.trim()
    if (!text || busy) return
    setBusy(true)
    const tempIds = Array.from({ length: kind === "image" ? Number(count) : kind === "audio" ? 1 : 0 }, (_, i) => `p-${Date.now()}-${i}`)
    setPending((p) => [...tempIds.map((id) => ({ id, aspect })), ...p])
    try {
      if (kind === "image") {
        const r = await store.generateImage({ prompt: text, model: imageModel, aspect, count: Number(count) })
        setAssets((cur) => [...r.assets.map((a) => ({ ...a, source: "generated" as const, prompt: text, createdAt: new Date().toISOString() })), ...(cur ?? [])])
        setCredits(r.credits)
      } else if (kind === "audio") {
        const r = await store.generateSpeech({ text, model: sm?.id ?? "auto", voice: voice || undefined })
        setAssets((cur) => [{ ...r.asset, source: "generated", prompt: text, createdAt: new Date().toISOString() }, ...(cur ?? [])])
        setCredits(r.credits)
      } else if (vm) {
        const r = await store.startVideo({ prompt: text, model: vm.id, seconds: Number(seconds), aspect, resolution, audio: withAudio })
        const job = { job: r.job, prompt: text, aspect, at: Date.now() }
        setJobs((cur) => {
          const next = [job, ...cur]
          writeJobs(next)
          return next
        })
        setCredits(r.credits)
        toast("Your clip is being made. It usually takes one to three minutes, and it keeps going if you leave this page.", "info")
      }
    } catch (e) {
      toast(e instanceof ArtError || e instanceof Error ? e.message : "That didn't work. Try again.", "error")
      if (e instanceof ArtError && e.code === "insufficient_credits") loadMe()
    } finally {
      setPending((p) => p.filter((x) => !tempIds.includes(x.id)))
      setBusy(false)
    }
  }

  const reuse = useCallback((p: string) => {
    setPrompt(p)
    inputRef.current?.focus()
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  const heroImages = useMemo(() => {
    const mine = (assets ?? []).filter((a) => a.kind === "image").slice(0, 5).map((a) => a.url)
    return [...mine, ...HERO.map(pub)].slice(0, 5)
  }, [assets])

  const ratioOf = (a: string) => a.replace(":", " / ")
  const Icon = copy.icon

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      {/* Hero */}
      <div className="relative h-[260px] overflow-hidden sm:h-[300px]">
        <div className="absolute inset-0 flex -skew-x-6 scale-110 gap-2">
          {heroImages.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src + i} src={src} alt="" className="h-full min-w-0 flex-1 object-cover opacity-70" />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/70 to-ink" />
      </div>

      <div className="relative mx-auto -mt-36 max-w-4xl px-5 pb-16">
        <div className="rise text-center">
          <p className={`label flex items-center justify-center gap-2 ${copy.color}`}>
            <Icon className="size-3.5" /> {kind === "audio" ? "Voice" : kind}
          </p>
          <h1 className="font-display mt-3 text-5xl sm:text-6xl">{copy.title}</h1>
          <p className="mt-3 text-[16px] text-[var(--muted)]">{copy.line}</p>
        </div>

        {/* Composer */}
        <div className="mt-8 rounded-[26px] border border-[var(--line-strong)] bg-ink-3/90 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl focus-within:border-cream/25">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate()
            }}
            rows={3}
            maxLength={kind === "video" ? 2000 : 4000}
            placeholder={copy.placeholder}
            className="w-full resize-none bg-transparent px-2 pt-1 text-[15.5px] leading-6 text-cream outline-none placeholder:text-[var(--faint)]"
            aria-label={kind === "audio" ? "Words to speak" : "Prompt"}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {kind === "image" && models && (
              <>
                <Select label="Aspect ratio" value={aspect} onChange={setAspect} icon={<RectangleHorizontal className="size-3.5" />} options={["1:1", "16:9", "9:16", "4:3", "3:4"].map((v) => ({ value: v, label: v }))} />
                <Select label="Number of images" value={count} onChange={setCount} icon={<Layers className="size-3.5" />} options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v }))} />
                <Select label="Model" value={imageModel} onChange={setImageModel} icon={<Sparkles className="size-3.5 text-violet" />} options={[{ value: "auto", label: "Auto" }, ...models.image.map((m) => ({ value: m.id, label: `${m.label} · ${m.credits} cr` }))]} />
              </>
            )}
            {kind === "video" && vm && models && (
              <>
                <Select label="Model" value={vm.id} onChange={setVideoModel} icon={<Sparkles className="size-3.5 text-violet" />} options={models.video.map((m) => ({ value: m.id, label: m.label }))} />
                <Select label="Length" value={seconds} onChange={setSeconds} icon={<Clock className="size-3.5" />} options={vm.durations.map((d) => ({ value: String(d), label: `${d}s` }))} />
                <Select label="Aspect ratio" value={aspect} onChange={setAspect} icon={<RectangleHorizontal className="size-3.5" />} options={vm.aspects.map((v) => ({ value: v, label: v }))} />
                <Select label="Resolution" value={resolution} onChange={setResolution} options={vm.resolutions.map((v) => ({ value: v, label: v }))} />
                {vm.audio && (
                  <button className={`chip ${withAudio ? "!border-blue/50 !text-cream" : ""}`} onClick={() => setWithAudio((a) => !a)} aria-pressed={withAudio}>
                    {withAudio ? <Volume2 className="size-3.5 text-blue" /> : <VolumeX className="size-3.5" />} Sound
                  </button>
                )}
              </>
            )}
            {kind === "audio" && sm && models && (
              <>
                <Select label="Voice model" value={sm.id} onChange={setVoiceModel} icon={<Sparkles className="size-3.5 text-violet" />} options={models.voice.map((m) => ({ value: m.id, label: m.label }))} />
                {sm.voices.length > 0 && <Select label="Voice" value={voice} onChange={setVoice} icon={<Mic className="size-3.5" />} options={sm.voices.map((v) => ({ value: v, label: v }))} />}
              </>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="font-mono text-[11px] text-[var(--faint)]">{prompt.trim() ? creditLabel(cost) : ""}</span>
              <button onClick={generate} disabled={!prompt.trim() || busy || !models} className="inline-flex h-10 items-center gap-2 rounded-full bg-cream pl-4 pr-3 text-sm font-medium text-ink transition-opacity hover:bg-white disabled:opacity-30">
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {kind === "audio" ? "Speak" : "Generate"}
                {!busy && <ArrowUp className="size-4" />}
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--faint)]">Ctrl+Enter to generate · You're only charged for what's made</p>

        {/* Results */}
        <div className="mt-12 flex items-center justify-between">
          <p className="label">Your {kind === "audio" ? "voiceovers" : `${kind}s`}</p>
          {assets && assets.length > 0 && <span className="font-mono text-[11px] text-[var(--faint)]">{assets.length}{assets.length >= 60 ? "+" : ""}</span>}
        </div>
        <div className={`mt-4 grid gap-3 ${kind === "audio" ? "sm:grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`}>
          {jobs.map((j) => (
            <div key={j.job} className="generating relative overflow-hidden rounded-2xl border border-blue/25" style={{ aspectRatio: ratioOf(j.aspect) }}>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="flex items-center gap-1.5 text-[12px] text-cream/80"><Loader2 className="size-3.5 animate-spin" /> Making your clip…</p>
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-4 text-[var(--muted)]">{j.prompt}</p>
              </div>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.id} className="generating rounded-2xl border border-[var(--line)]" style={kind === "audio" ? { height: 140 } : { aspectRatio: ratioOf(p.aspect) }} aria-label="Generating" />
          ))}
          {assets?.map((a) => <MediaCard key={a.id} asset={a} onOpen={() => setView(a)} onReuse={reuse} />)}
        </div>
        {assets === null && (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-[var(--faint)]">
            <Loader2 className="size-4 animate-spin" /> Loading
          </p>
        )}
        {assets?.length === 0 && pending.length === 0 && jobs.length === 0 && (
          <div className="mt-2 rounded-2xl border border-dashed border-[var(--line-strong)] px-6 py-12 text-center text-[14px] text-[var(--muted)]">
            Nothing yet. Describe something above and press {kind === "audio" ? "Speak" : "Generate"}.
          </div>
        )}
      </div>
      <Lightbox asset={view} onClose={() => setView(null)} />
    </div>
  )
}
