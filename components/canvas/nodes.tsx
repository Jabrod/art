"use client"

/**
 * The canvas nodes. Each has a fixed frame (lib/nodes sizeFor), so media loading never changes
 * its size. Text fields carry `nodrag nowheel` so typing and scrolling in them never pans the board.
 * Inputs on the left (target handle), output on the right (source handle).
 */
import { memo, useMemo, useRef } from "react"
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react"
import { Scissors } from "lucide-react"
import { editorHref } from "@/lib/editor"
import { AlertTriangle, ArrowRight, AudioLines, Clapperboard, Download, FileDown, Image as ImageIcon, Loader2, NotebookPen, Play, Sparkles, Upload } from "lucide-react"
import { incomingMedia, type NodeKind } from "@/lib/board"
import { useApp } from "@/lib/app-state"
import { runNode, replaceWithFile } from "@/lib/generate"
import { downloadAsset, fmtDuration, useAssetUrl } from "@/lib/media"
import { FOOTER, HEADER, KIND_COLOR, KIND_LABEL } from "@/lib/nodes"
import { useBoard, type FlowNode } from "@/lib/useBoard"

const ICON: Record<NodeKind, typeof ImageIcon> = {
  prompt: Sparkles,
  note: NotebookPen,
  image: ImageIcon,
  video: Clapperboard,
  audio: AudioLines,
  export: FileDown,
}

function Frame({ id, kind, selected, children, right, inputs = true, outputs = true, minH = 120 }: { id: string; kind: NodeKind; selected?: boolean; children: React.ReactNode; right?: React.ReactNode; inputs?: boolean; outputs?: boolean; minH?: number }) {
  const Icon = ICON[kind]
  const color = KIND_COLOR[kind]
  const status = useBoard((s) => s.nodes.find((n) => n.id === id)?.data.status)
  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-paper-2 transition-[border-color,box-shadow] duration-150 ${
        selected ? "border-ink shadow-[var(--lift-high)]" : "border-[var(--line)] shadow-[var(--lift)]"
      }`}
    >
      <NodeResizer isVisible={selected} minWidth={200} minHeight={minH} keepAspectRatio={kind === "image" || kind === "video"} lineClassName="!border-transparent" />
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] px-3" style={{ height: HEADER }}>
        {/* the kind, marked with a dab of its paint */}
        <span className="dab" style={{ color }} aria-hidden />
        <span className="text-[12.5px] font-medium text-ink/80">{KIND_LABEL[kind]}</span>
        <Icon className="size-3.5 text-ink/30" aria-hidden />
        {status === "working" && <Loader2 className="size-3 animate-spin text-ink/50" />}
        {status === "error" && <AlertTriangle className="size-3 text-ink/60" />}
        <div className="ml-auto flex items-center gap-1">{right}</div>
      </div>
      {children}
      {inputs && <Handle type="target" position={Position.Left} style={{ top: "50%" }} />}
      {outputs && <Handle type="source" position={Position.Right} style={{ top: "50%" }} />}
    </div>
  )
}

function TextArea({ id, field, placeholder, className = "" }: { id: string; field: "text" | "prompt"; placeholder: string; className?: string }) {
  const value = useBoard((s) => (s.nodes.find((n) => n.id === id)?.data[field] as string | undefined) ?? "")
  const update = useBoard((s) => s.update)
  const checkpoint = useBoard((s) => s.checkpoint)
  return (
    <textarea
      value={value}
      onFocus={checkpoint}
      onChange={(e) => update(id, { [field]: e.target.value })}
      placeholder={placeholder}
      className={`nodrag nowheel w-full flex-1 resize-none bg-transparent px-3 pb-3 text-[13.5px] leading-[1.55] text-ink/90 outline-none placeholder:text-[var(--faint)] scroll-thin ${className}`}
      spellCheck
    />
  )
}

export const PromptNode = memo(function PromptNode({ id, selected }: NodeProps<FlowNode>) {
  return (
    <Frame id={id} kind="prompt" selected={selected} inputs={false}>
      <TextArea id={id} field="text" placeholder="Describe the idea. Connect this to an image, video or audio node to use it as their prompt." />
    </Frame>
  )
})

export const NoteNode = memo(function NoteNode({ id, selected }: NodeProps<FlowNode>) {
  return (
    <Frame id={id} kind="note" selected={selected} inputs={false}>
      <TextArea id={id} field="text" placeholder="A note for this board…" className="font-mono !text-[12.5px] text-ink/75" />
    </Frame>
  )
})

/** The footer of a generator: its own prompt, and the button that runs it. */
function GenFooter({ id, kind }: { id: string; kind: "image" | "video" | "audio" }) {
  const status = useBoard((s) => s.nodes.find((n) => n.id === id)?.data.status)
  const working = status === "working"
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-[var(--line)] px-2" style={{ height: FOOTER }}>
      <InlinePrompt id={id} field={kind === "audio" ? "text" : "prompt"} placeholder={kind === "audio" ? "Words to speak…" : "Prompt (adds to connected ones)…"} />
      <button
        onClick={() => runNode(id)}
        disabled={working}
        className="nodrag inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink pl-3 pr-2.5 text-[12px] font-medium text-paper transition-opacity hover:bg-white disabled:opacity-40"
        title="Generate (uses the prompts wired into this node, then its own)"
      >
        {working ? <Loader2 className="size-3.5 animate-spin" /> : kind === "audio" ? "Speak" : "Generate"}
        {!working && <ArrowRight className="size-3.5" />}
      </button>
    </div>
  )
}

function InlinePrompt({ id, field, placeholder }: { id: string; field: "text" | "prompt"; placeholder: string }) {
  const value = useBoard((s) => (s.nodes.find((n) => n.id === id)?.data[field] as string | undefined) ?? "")
  const update = useBoard((s) => s.update)
  const checkpoint = useBoard((s) => s.checkpoint)
  return (
    <input
      value={value}
      onFocus={checkpoint}
      onChange={(e) => update(id, { [field]: e.target.value })}
      onKeyDown={(e) => e.key === "Enter" && runNode(id)}
      placeholder={placeholder}
      className="nodrag min-w-0 flex-1 rounded-lg bg-transparent px-1.5 text-[12.5px] text-ink/90 outline-none placeholder:text-[var(--faint)] focus:bg-ink/[0.04]"
    />
  )
}

/** Empty, generating, uploading or failed: what a media frame shows before it has media. */
function MediaState({ id, kind }: { id: string; kind: "image" | "video" | "audio" }) {
  const data = useBoard((s) => s.nodes.find((n) => n.id === id)?.data)
  const progress = useBoard((s) => s.progress[id])
  const fileRef = useRef<HTMLInputElement>(null)
  if (data?.status === "working") {
    return (
      <div className="generating flex h-full w-full flex-col items-center justify-center gap-2 text-[12px] text-ink/75">
        <Loader2 className="size-4 animate-spin" />
        {progress != null ? `Uploading ${Math.round(progress * 100)}%` : kind === "video" ? "Making the clip…" : kind === "audio" ? "Recording the voice…" : "Painting…"}
      </div>
    )
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-paper-3/60 p-4 text-center">
      {data?.status === "error" ? (
        <p className="line-clamp-4 text-[12px] leading-5 text-ink/60">{data.error}</p>
      ) : (
        <p className="text-[12px] leading-5 text-[var(--faint)]">Generate from a prompt, or bring your own {kind}.</p>
      )}
      <div className="flex gap-2">
        <button onClick={() => runNode(id)} className="nodrag btn-ghost !h-8 !px-3 !text-[12px]">
          <Sparkles className="size-3.5 text-ink/60" /> Generate
        </button>
        <button onClick={() => fileRef.current?.click()} className="nodrag btn-ghost !h-8 !px-3 !text-[12px]">
          <Upload className="size-3.5" /> Upload
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept={kind === "image" ? "image/*" : kind === "video" ? "video/mp4,video/webm,video/quicktime" : "audio/*"}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) replaceWithFile(id, f)
          e.target.value = ""
        }}
      />
    </div>
  )
}

export const ImageNode = memo(function ImageNode({ id, data, selected }: NodeProps<FlowNode>) {
  const url = useAssetUrl(data.asset)
  return (
    <Frame id={id} kind="image" selected={selected} minH={200} right={data.asset && <IconAction label="Download" onClick={() => downloadAsset(data.asset!)} icon={Download} />}>
      <div className="relative min-h-0 flex-1 bg-black/30">
        {data.asset && url && data.status !== "working" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={data.prompt || data.label || "Image"} draggable={false} decoding="async" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <MediaState id={id} kind="image" />
        )}
      </div>
      <GenFooter id={id} kind="image" />
    </Frame>
  )
})

export const VideoNode = memo(function VideoNode({ id, data, selected }: NodeProps<FlowNode>) {
  const url = useAssetUrl(data.asset)
  return (
    <Frame
      id={id}
      kind="video"
      selected={selected}
      minH={200}
      right={
        data.asset && (
          <>
            {!data.asset.url.startsWith("idb:") && <IconAction label="Open in Editor" onClick={() => window.location.assign(editorHref(data.asset!))} icon={Scissors} />}
            <IconAction label="Download" onClick={() => downloadAsset(data.asset!)} icon={Download} />
          </>
        )
      }
    >
      <div className="relative min-h-0 flex-1 bg-black">
        {data.asset && url && data.status !== "working" ? (
          <video src={url} controls preload="metadata" playsInline className="nodrag absolute inset-0 h-full w-full object-contain" />
        ) : (
          <MediaState id={id} kind="video" />
        )}
      </div>
      <GenFooter id={id} kind="video" />
    </Frame>
  )
})

export const AudioNode = memo(function AudioNode({ id, data, selected }: NodeProps<FlowNode>) {
  const url = useAssetUrl(data.asset)
  return (
    <Frame id={id} kind="audio" selected={selected} minH={170} right={data.asset && <IconAction label="Download" onClick={() => downloadAsset(data.asset!)} icon={Download} />}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-3">
        {data.asset && url && data.status !== "working" ? (
          <>
            <p className="truncate text-[12px] text-ink/70">
              {data.label} <span className="font-mono text-[var(--faint)]">{fmtDuration(data.asset.durationMs)}</span>
            </p>
            <audio src={url} controls preload="metadata" className="nodrag h-9 w-full" />
          </>
        ) : (
          <div className="h-full min-h-[70px] overflow-hidden rounded-xl">
            <MediaState id={id} kind="audio" />
          </div>
        )}
      </div>
      <GenFooter id={id} kind="audio" />
    </Frame>
  )
})

export const ExportNode = memo(function ExportNode({ id, selected }: NodeProps<FlowNode>) {
  const nodes = useBoard((s) => s.nodes)
  const edges = useBoard((s) => s.edges)
  const media = useMemo(() => incomingMedia(id, { nodes: nodes.map((n) => ({ id: n.id, type: n.type as NodeKind, position: n.position, width: 0, height: 0, data: n.data })), edges }), [id, nodes, edges])
  const hasDevice = useApp((s) => s.me?.jbd?.hasDevice)
  return (
    <Frame id={id} kind="export" selected={selected} outputs={false} minH={180}>
      <div className="nowheel min-h-0 flex-1 overflow-y-auto px-3 scroll-thin">
        {media.length === 0 ? (
          <p className="text-[12px] leading-5 text-[var(--faint)]">Connect images, clips and audio here to take them out of the studio.</p>
        ) : (
          media.map((m) => (
            <button key={m.id} onClick={() => downloadAsset(m)} className="nodrag flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-[12px] text-ink/80 hover:bg-ink/[0.05]">
              {m.kind === "image" ? <ImageIcon className="size-3.5 text-ink/60" /> : m.kind === "video" ? <Clapperboard className="size-3.5 text-ink/60" /> : <AudioLines className="size-3.5 text-ink/60" />}
              <span className="min-w-0 flex-1 truncate">{m.name ?? m.kind}</span>
              <Download className="size-3 text-[var(--faint)]" />
            </button>
          ))
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-[var(--line)] p-2">
        <button disabled={media.length === 0} onClick={() => media.forEach((m, i) => setTimeout(() => downloadAsset(m), i * 400))} className="nodrag btn-ghost !h-8 w-full !text-[12px]">
          <Download className="size-3.5" /> Download all ({media.length})
        </button>
        <a href="/studio/editor" className="nodrag inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-ink text-[12px] font-medium text-paper hover:bg-white" title="Open the Editor, then Open from Library to bring these files in">
          <Play className="size-3.5" /> Edit in the Editor
        </a>
      </div>
    </Frame>
  )
})

function IconAction({ label, onClick, icon: Icon }: { label: string; onClick: () => void; icon: typeof Download }) {
  return (
    <button onClick={onClick} className="nodrag icon-btn !size-6" aria-label={label} title={label}>
      <Icon className="size-3.5" />
    </button>
  )
}

export const nodeTypes = { prompt: PromptNode, note: NoteNode, image: ImageNode, video: VideoNode, audio: AudioNode, export: ExportNode }
