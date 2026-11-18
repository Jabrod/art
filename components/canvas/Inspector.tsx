"use client"

/** Settings for the one selected node: model and output options, the prompt it will run with, file actions. */
import { useMemo, useRef } from "react"
import { Copy, Download, Trash2, Upload } from "lucide-react"
import { promptFor, type NodeKind } from "@/lib/board"
import { creditLabel, useApp } from "@/lib/app-state"
import { replaceWithFile } from "@/lib/generate"
import { downloadAsset } from "@/lib/media"
import { KIND_COLOR, KIND_LABEL } from "@/lib/nodes"
import { useBoard, type FlowNode } from "@/lib/useBoard"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label !text-[9.5px]">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function Pick({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="field h-9 w-full cursor-pointer text-[13px]">
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-paper-2">
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Inspector({ node }: { node: FlowNode }) {
  const kind = node.type as NodeKind
  const d = node.data
  const models = useApp((s) => s.models)
  const update = useBoard((s) => s.update)
  const nodes = useBoard((s) => s.nodes)
  const edges = useBoard((s) => s.edges)
  const fileRef = useRef<HTMLInputElement>(null)

  const runPrompt = useMemo(
    () => (kind === "image" || kind === "video" || kind === "audio" ? promptFor(node.id, { nodes: nodes.map((n) => ({ id: n.id, type: n.type as NodeKind, position: n.position, width: 0, height: 0, data: n.data })), edges }) : ""),
    [kind, node.id, nodes, edges],
  )

  const set = (patch: Record<string, unknown>, resize = false) => update(node.id, patch, { resize })

  const vm = models?.video.find((m) => m.id === d.model) ?? models?.video.find((m) => m.default) ?? models?.video[0]
  const sm = models?.voice.find((m) => m.id === d.model) ?? models?.voice.find((m) => m.default) ?? models?.voice[0]
  const im = models?.image.find((m) => m.id === d.model) ?? models?.image.find((m) => m.default) ?? models?.image[0]

  let cost = 0
  if (kind === "image") cost = im?.credits ?? 0
  if (kind === "video" && vm) {
    const res = d.resolution && vm.resolutions.includes(d.resolution) ? d.resolution : vm.resolutions.includes("720p") ? "720p" : vm.resolutions[0]
    const secs = d.seconds && vm.durations.includes(d.seconds) ? d.seconds : vm.durations.includes(5) ? 5 : vm.durations[0]
    cost = ((d.audio ? vm.audioCreditsPerSecond[res] : vm.creditsPerSecond[res]) ?? vm.creditsPerSecond[res] ?? 0) * secs
  }
  if (kind === "audio" && sm) cost = Math.max(1, (sm.creditsPer1k * [...runPrompt].length) / 1000)

  return (
    <div className="rise absolute bottom-3 right-3 top-[68px] z-10 flex w-[280px] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-paper-2/95 shadow-[var(--lift)]" aria-label={`${KIND_LABEL[kind]} settings`}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] px-4">
        <span className="size-2 rounded-full" style={{ background: KIND_COLOR[kind] }} />
        <span className="text-[13px] text-ink">{KIND_LABEL[kind]}</span>
        <div className="ml-auto flex">
          <button className="icon-btn" onClick={() => useBoard.getState().duplicateSelected()} aria-label="Duplicate (Ctrl+D)" title="Duplicate (Ctrl+D)">
            <Copy className="size-3.5" />
          </button>
          <button className="icon-btn hover:!text-ink/60" onClick={() => useBoard.getState().removeNodes([node.id])} aria-label="Delete (Del)" title="Delete (Del)">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 scroll-thin">
        {kind === "image" && models && (
          <>
            <Row label="Model">
              <Pick value={d.model || im?.id || ""} onChange={(v) => set({ model: v })} options={models.image.map((m) => ({ value: m.id, label: `${m.label} · ${m.credits} cr` }))} />
            </Row>
            <Row label="Aspect ratio">
              <Pick value={d.aspect || "1:1"} onChange={(v) => set({ aspect: v }, !d.asset)} options={(im?.aspects ?? ["1:1"]).map((a) => ({ value: a, label: a }))} />
            </Row>
          </>
        )}
        {kind === "video" && vm && models && (
          <>
            <Row label="Model">
              <Pick value={vm.id} onChange={(v) => set({ model: v })} options={models.video.map((m) => ({ value: m.id, label: m.label }))} />
            </Row>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Length">
                <Pick value={String(d.seconds && vm.durations.includes(d.seconds) ? d.seconds : vm.durations.includes(5) ? 5 : vm.durations[0])} onChange={(v) => set({ seconds: Number(v) })} options={vm.durations.map((x) => ({ value: String(x), label: `${x}s` }))} />
              </Row>
              <Row label="Resolution">
                <Pick value={d.resolution && vm.resolutions.includes(d.resolution) ? d.resolution : vm.resolutions.includes("720p") ? "720p" : vm.resolutions[0]} onChange={(v) => set({ resolution: v })} options={vm.resolutions.map((x) => ({ value: x, label: x }))} />
              </Row>
            </div>
            <Row label="Aspect ratio">
              <Pick value={d.aspect && vm.aspects.includes(d.aspect) ? d.aspect : vm.aspects[0]} onChange={(v) => set({ aspect: v }, !d.asset)} options={vm.aspects.map((x) => ({ value: x, label: x }))} />
            </Row>
            {vm.audio && (
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-[13px] text-ink/85">
                Generate sound
                <input type="checkbox" checked={Boolean(d.audio)} onChange={(e) => set({ audio: e.target.checked })} className="size-4 accent-[#f3eee2]" />
              </label>
            )}
          </>
        )}
        {kind === "audio" && sm && models && (
          <>
            <Row label="Voice model">
              <Pick value={sm.id} onChange={(v) => set({ model: v, voice: undefined })} options={models.voice.map((m) => ({ value: m.id, label: m.label }))} />
            </Row>
            {sm.voices.length > 0 && (
              <Row label="Voice">
                <Pick value={d.voice && sm.voices.includes(d.voice) ? d.voice : sm.voices[0]} onChange={(v) => set({ voice: v })} options={sm.voices.map((x) => ({ value: x, label: x }))} />
              </Row>
            )}
          </>
        )}

        {(kind === "image" || kind === "video" || kind === "audio") && (
          <>
            <Row label={kind === "audio" ? "Will speak" : "Will generate from"}>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-paper-3 p-3 text-[12.5px] leading-5 text-ink/80 scroll-thin">
                {runPrompt || <span className="text-[var(--faint)]">Nothing yet. Type in the node's prompt line, or connect a Prompt node.</span>}
              </p>
            </Row>
            <p className="font-mono text-[11px] text-[var(--faint)]">Cost: {creditLabel(cost)}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn-ghost !h-8" onClick={() => fileRef.current?.click()}>
                <Upload className="size-3.5" /> {d.asset ? "Replace" : "Upload"}
              </button>
              {d.asset && (
                <button className="btn-ghost !h-8" onClick={() => downloadAsset(d.asset!)}>
                  <Download className="size-3.5" /> Download
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={kind === "image" ? "image/*" : kind === "video" ? "video/mp4,video/webm,video/quicktime" : "audio/*"}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) replaceWithFile(node.id, f)
                e.target.value = ""
              }}
            />
          </>
        )}
        {(kind === "prompt" || kind === "note") && <p className="text-[12.5px] leading-5 text-[var(--muted)]">{kind === "prompt" ? "Connect this prompt (drag from its right dot) into image, video or audio nodes. Several prompts can feed one node; they're joined in the order you connected them." : "Notes are for you. Connect one into a generator to add it to the prompt."}</p>}
        {kind === "export" && <p className="text-[12.5px] leading-5 text-[var(--muted)]">Everything connected here can be downloaded together, or opened in the Editor to cut the clips, voice and images into a finished video.</p>}
      </div>
    </div>
  )
}
