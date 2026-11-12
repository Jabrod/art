import { describe, expect, it } from "vitest"
import { emptyDoc, incomingMedia, mediaHeight, parseBoardDoc, promptFor, uploadProblem, type BoardDoc } from "@/lib/board"

const node = (id: string, type: string, data: Record<string, unknown> = {}) => ({ id, type, position: { x: 0, y: 0 }, width: 200, height: 100, data })

describe("parseBoardDoc", () => {
  it("returns an empty doc for anything that isn't an object", () => {
    expect(parseBoardDoc(null)).toEqual(emptyDoc())
    expect(parseBoardDoc("nope")).toEqual(emptyDoc())
  })

  it("drops runtime fields and unknown kinds", () => {
    const doc = parseBoardDoc({
      nodes: [node("a", "image", { prompt: "cat", playing: true, progress: 0.4 }), node("b", "spaceship")],
      edges: [],
    })
    expect(doc.nodes).toHaveLength(1)
    expect(doc.nodes[0].data).toEqual({ prompt: "cat" })
  })

  it("drops edges whose ends are missing", () => {
    const doc = parseBoardDoc({ nodes: [node("a", "prompt")], edges: [{ id: "e", source: "a", target: "zzz" }] })
    expect(doc.edges).toEqual([])
  })

  it("resets an interrupted generation unless a job can be resumed", () => {
    const doc = parseBoardDoc({
      nodes: [node("img", "image", { status: "working" }), node("vid", "video", { status: "working", job: "tok" })],
      edges: [],
    })
    expect(doc.nodes[0].data.status).toBe("idle")
    expect(doc.nodes[1].data.status).toBe("working")
  })

  it("clamps the zoom", () => {
    expect(parseBoardDoc({ viewport: { x: 1, y: 2, zoom: 99 } }).viewport).toEqual({ x: 1, y: 2, zoom: 4 })
  })
})

describe("promptFor", () => {
  const doc = parseBoardDoc({
    nodes: [node("p1", "prompt", { text: "a" }), node("p2", "note", { text: "b" }), node("img", "image", { prompt: "c" }), node("au", "audio", { text: "say" })],
    edges: [
      { id: "1", source: "p1", target: "img" },
      { id: "2", source: "p2", target: "img" },
      { id: "3", source: "p1", target: "au" },
    ],
  }) as BoardDoc

  it("joins connected prompts in edge order, then the node's own prompt", () => {
    expect(promptFor("img", doc)).toBe("a\n\nb\n\nc")
  })

  it("uses an audio node's own text as its words", () => {
    expect(promptFor("au", doc)).toBe("a\n\nsay")
  })
})

describe("incomingMedia", () => {
  it("lists connected assets once each", () => {
    const asset = { id: "x", kind: "image", url: "https://e/x.png" }
    const doc = parseBoardDoc({
      nodes: [node("i", "image", { asset }), node("ex", "export")],
      edges: [
        { id: "1", source: "i", target: "ex" },
        { id: "2", source: "i", target: "ex" },
      ],
    })
    expect(incomingMedia("ex", doc)).toEqual([asset])
  })
})

describe("uploads", () => {
  it("rejects unsupported and oversized files", () => {
    expect(uploadProblem({ name: "a.pdf", type: "application/pdf", size: 10 })).toMatch(/isn't an image/)
    expect(uploadProblem({ name: "a.png", type: "image/png", size: 21 * 1024 * 1024 })).toMatch(/20 MB/)
    expect(uploadProblem({ name: "a.mp4", type: "video/mp4", size: 1024 })).toBeNull()
  })

  it("sizes media frames by aspect", () => {
    expect(mediaHeight(300, "16:9")).toBe(169)
    expect(mediaHeight(300, { width: 1000, height: 1000 })).toBe(300)
  })
})
