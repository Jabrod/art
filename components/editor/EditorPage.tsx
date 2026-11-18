"use client"

/**
 * The Editor: JBD's video editor (Jabrod/jbd apps/filmcraft-web, Apache-2.0) running in the studio.
 * It loads in a same-site frame (public/editor-app, built with `cargo xtask web`), and the studio
 * drives it through its `window.filmcraft` API: Library and board files open in it, and exports
 * (files under /exports) save back to the Library. The web build is single-threaded, so long or
 * high-resolution exports take a while; the AI Director isn't in the web build yet.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FolderOpen, Loader2, Save, X } from "lucide-react"
import { BASE, useApp } from "@/lib/app-state"
import { probeFile } from "@/lib/media"
import { store, type LibraryAsset } from "@/lib/store"

interface FilmCraft {
  importUrl(url: string, name?: string): Promise<unknown>
  files(): Promise<{ path: string; size: number; kind: string }[]>
  readFile(path: string): Promise<Uint8Array>
}

type Win = Window & { filmcraft?: FilmCraft; filmcraftLoad?: { readyMs?: number; fatal?: unknown } }

const MIME: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", wav: "audio/wav", mp3: "audio/mpeg", png: "image/png", jpg: "image/jpeg" }

export function EditorPage() {
  const params = useSearchParams()
  const toast = useApp((s) => s.toast)
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [picker, setPicker] = useState<LibraryAsset[] | null>(null)
  const [exports, setExports] = useState<{ path: string; size: number }[] | null>(null)
  const opened = useRef(false)

  const fc = useCallback(() => (frame.current?.contentWindow as Win | null)?.filmcraft ?? null, [])

  // Wait for the editor inside the frame to finish starting.
  useEffect(() => {
    const t = setInterval(() => {
      const w = frame.current?.contentWindow as Win | null
      if (w?.filmcraft && w.filmcraftLoad?.readyMs) {
        setReady(true)
        clearInterval(t)
      }
    }, 300)
    return () => clearInterval(t)
  }, [])

  const openUrl = useCallback(
    async (url: string, name?: string) => {
      const f = fc()
      if (!f) return
      setBusy(`Opening ${name ?? "the file"}…`)
      try {
        await f.importUrl(url, name)
        toast(`${name ?? "File"} is in the editor's media bin.`, "ok")
      } catch (e) {
        toast(`Couldn't open ${name ?? "that file"} in the editor: ${e instanceof Error ? e.message : String(e)}`, "error")
      } finally {
        setBusy(null)
      }
    },
    [fc, toast],
  )

  // /studio/editor?url=…&name=… (from the Library or a board) opens that file once the editor is up.
  useEffect(() => {
    if (!ready || opened.current) return
    const url = params.get("url")
    if (!url) return
    opened.current = true
    openUrl(url, params.get("name") ?? undefined)
  }, [ready, params, openUrl])

  async function showPicker() {
    setPicker([])
    try {
      setPicker(await store.listAssets())
    } catch {
      setPicker([])
      toast("Couldn't load your Library.", "error")
    }
  }

  async function showExports() {
    const f = fc()
    if (!f) return
    try {
      const all = await f.files()
      setExports(all.filter((x) => x.path.startsWith("/exports/") || /\.(mp4|webm|mov|wav|mp3)$/i.test(x.path)).map(({ path, size }) => ({ path, size })))
    } catch {
      toast("Couldn't read the editor's files.", "error")
    }
  }

  async function saveToLibrary(path: string) {
    const f = fc()
    if (!f) return
    const name = path.split("/").pop() || "export.mp4"
    const ext = name.split(".").pop()?.toLowerCase() ?? "mp4"
    setBusy(`Saving ${name} to your Library…`)
    try {
      const bytes = await f.readFile(path)
      const file = new File([bytes as BlobPart], name, { type: MIME[ext] ?? "video/mp4" })
      const info = await probeFile(file)
      await store.upload(file, null, info)
      toast(`${name} is saved in your Library.`, "ok")
      setExports(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : `Couldn't save ${name}.`, "error")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] px-3">
        <span className="text-[14px] font-medium text-ink">Editor</span>
        <span className="text-[12px] text-[var(--faint)]">Video editor</span>
        <div className="ml-auto flex items-center gap-2">
          {busy && (
            <span className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
              <Loader2 className="size-3.5 animate-spin" /> {busy}
            </span>
          )}
          <button className="btn-ghost !h-8" disabled={!ready} onClick={showPicker}>
            <FolderOpen className="size-3.5" /> Open from Library
          </button>
          <button className="btn-ghost !h-8" disabled={!ready} onClick={showExports}>
            <Save className="size-3.5" /> Save export to Library
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <iframe ref={frame} src={`${BASE}/editor-app/index.html`} title="Editor" className="absolute inset-0 h-full w-full border-0 bg-paper" allow="autoplay; clipboard-read; clipboard-write" />
        {!ready && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-paper text-[13px] text-[var(--muted)]">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Starting the editor
            </span>
          </div>
        )}
        <p className="absolute inset-x-0 bottom-0 bg-paper-2 px-4 py-2 text-center text-[12px] text-[var(--muted)] md:hidden">Editing works best on a computer; on a phone the editor is cramped and slower.</p>
      </div>

      {(picker || exports) && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/25 p-4" onMouseDown={(e) => e.target === e.currentTarget && (setPicker(null), setExports(null))}>
          <div className="rise w-full max-w-lg rounded-2xl border border-[var(--line-strong)] bg-paper-2 p-5 shadow-[var(--lift-high)]" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-medium text-ink">{picker ? "Open from your Library" : "Save an export to your Library"}</p>
              <button className="icon-btn" aria-label="Close" onClick={() => (setPicker(null), setExports(null))}>
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-3 max-h-[50vh] overflow-y-auto scroll-thin">
              {picker?.length === 0 && <p className="py-6 text-center text-[13px] text-[var(--faint)]">Nothing in your Library yet.</p>}
              {picker?.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setPicker(null)
                    openUrl(a.url, a.name ?? `${a.kind}-${a.id.slice(0, 6)}`)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] text-ink/85 hover:bg-ink/[0.05]"
                >
                  <span className="w-12 shrink-0 text-[11px] text-[var(--faint)]">{a.kind}</span>
                  <span className="min-w-0 flex-1 truncate">{a.name ?? a.prompt ?? a.id}</span>
                </button>
              ))}
              {exports?.length === 0 && <p className="py-6 text-center text-[13px] leading-6 text-[var(--faint)]">No exports yet. Export from the editor (File, then Export), then save it here.</p>}
              {exports?.map((x) => (
                <button key={x.path} onClick={() => saveToLibrary(x.path)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] text-ink/85 hover:bg-ink/[0.05]">
                  <span className="min-w-0 flex-1 truncate">{x.path}</span>
                  <span className="shrink-0 font-mono text-[11px] text-[var(--faint)]">{(x.size / 1024 / 1024).toFixed(1)} MB</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
