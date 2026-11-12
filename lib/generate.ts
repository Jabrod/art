"use client"

/** Running a canvas node: its prompt is everything wired into it plus its own (lib/board promptFor). */
import { promptFor, uploadProblem, type NodeKind } from "@/lib/board"
import { useApp } from "@/lib/app-state"
import { probeFile } from "@/lib/media"
import { makeNode } from "@/lib/nodes"
import { ArtError, store } from "@/lib/store"
import { useBoard } from "@/lib/useBoard"

const app = () => useApp.getState()
const board = () => useBoard.getState()

function fail(id: string, e: unknown) {
  const message = e instanceof ArtError || e instanceof Error ? e.message : "That didn't work. Try again."
  board().update(id, { status: "error", error: message })
  app().toast(message, "error")
  if (e instanceof ArtError && (e.code === "insufficient_credits" || e.code === "limit_reached")) app().loadMe()
}

export async function runNode(id: string) {
  const b = board()
  const node = b.nodes.find((n) => n.id === id)
  if (!node || node.data.status === "working" || !b.boardId) return
  const doc = b.doc()
  const prompt = promptFor(id, doc)
  if (!prompt) {
    app().toast(node.type === "audio" ? "Write the words to speak, or connect a prompt." : "Write a prompt, or connect a Prompt node to this one.", "info")
    return
  }
  const d = node.data
  b.checkpoint()
  b.update(id, { status: "working", error: undefined })
  try {
    if (node.type === "image") {
      const r = await store.generateImage({ boardId: b.boardId, prompt, model: d.model || "auto", aspect: d.aspect || "1:1", count: 1 })
      board().update(id, { status: "idle", asset: r.assets[0], label: r.assets[0].name }, { resize: true })
      app().setCredits(r.credits)
    } else if (node.type === "audio") {
      const r = await store.generateSpeech({ boardId: b.boardId, text: prompt, model: d.model || "auto", voice: d.voice })
      board().update(id, { status: "idle", asset: r.asset, label: r.asset.name })
      app().setCredits(r.credits)
    } else if (node.type === "video") {
      const models = app().models?.video ?? []
      const m = models.find((x) => x.id === d.model) ?? models.find((x) => x.default) ?? models[0]
      if (!m) throw new ArtError("Video models haven't loaded yet. Try again in a moment.")
      const seconds = d.seconds && m.durations.includes(d.seconds) ? d.seconds : m.durations.includes(5) ? 5 : m.durations[0]
      const resolution = d.resolution && m.resolutions.includes(d.resolution) ? d.resolution : m.resolutions.includes("720p") ? "720p" : m.resolutions[0]
      const aspect = d.aspect && m.aspects.includes(d.aspect) ? d.aspect : m.aspects[0]
      const r = await store.startVideo({ boardId: b.boardId, prompt, model: m.id, seconds, aspect, resolution, audio: Boolean(d.audio && m.audio) })
      board().update(id, { job: r.job, model: m.id, seconds, resolution, aspect })
      app().setCredits(r.credits)
      app().toast("The clip is being made (usually 1–3 minutes). Keep working; it lands in the node.", "info")
    }
  } catch (e) {
    fail(id, e)
  }
}

/** One status check for every video node that's waiting on a job. */
export async function pollVideos() {
  const b = board()
  for (const n of b.nodes) {
    if (n.type !== "video" || n.data.status !== "working" || !n.data.job) continue
    try {
      const s = await store.videoStatus(n.data.job, b.boardId, promptFor(n.id, b.doc()))
      if (s.status === "pending") continue
      if (s.status === "done") {
        board().update(n.id, { status: "idle", job: undefined, asset: s.asset, label: s.asset.name }, { resize: true })
        app().toast("A clip finished on your board.", "ok")
      } else {
        board().update(n.id, { status: "error", job: undefined, error: s.error })
        app().loadMe()
      }
    } catch {
      // checked again on the next tick
    }
  }
}

/** Puts files on the board at a point (drop, paste, upload button): one node each, uploading. */
export async function addFiles(files: File[], at: { x: number; y: number }) {
  const b = board()
  if (!b.boardId) return
  let y = at.y
  for (const file of files) {
    const problem = uploadProblem(file)
    if (problem) {
      app().toast(problem, "error")
      continue
    }
    let info
    try {
      info = await probeFile(file)
    } catch {
      app().toast(`${file.name} couldn't be read.`, "error")
      continue
    }
    const node = makeNode(info.kind as NodeKind, { x: at.x, y }, { status: "working", label: file.name, aspect: info.width && info.height ? undefined : undefined })
    y += node.height + 32
    b.addNodes([node])
    upload(node.id, file, info)
  }
}

async function upload(id: string, file: File, info: Awaited<ReturnType<typeof probeFile>>) {
  const b = board()
  try {
    const asset = await store.upload(file, b.boardId, info, (p) => board().setProgress(id, p))
    board().update(id, { status: "idle", asset, label: asset.name ?? file.name }, { resize: true })
  } catch (e) {
    // a failed upload leaves no empty node behind
    board().removeNodes([id])
    app().toast(e instanceof Error ? e.message : `Couldn't upload ${file.name}.`, "error")
  } finally {
    board().setProgress(id, null)
  }
}

/** Replaces a media node's file with an upload. */
export async function replaceWithFile(id: string, file: File) {
  const problem = uploadProblem(file)
  if (problem) return app().toast(problem, "error")
  const info = await probeFile(file).catch(() => null)
  if (!info) return app().toast(`${file.name} couldn't be read.`, "error")
  const node = board().nodes.find((n) => n.id === id)
  if (node && node.type !== info.kind) return app().toast(`This is a ${node.type} node; drop the ${info.kind} file on the canvas instead.`, "error")
  board().checkpoint()
  board().update(id, { status: "working" })
  try {
    const asset = await store.upload(file, board().boardId, info, (p) => board().setProgress(id, p))
    board().update(id, { status: "idle", asset, label: asset.name ?? file.name, error: undefined }, { resize: true })
  } catch (e) {
    fail(id, e)
  } finally {
    board().setProgress(id, null)
  }
}
