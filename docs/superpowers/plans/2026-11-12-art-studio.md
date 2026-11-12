# Jabrod Art Studio v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An open-source infinite canvas at art.localhost:3000/studio where a signed-in person
creates boards and adds, connects, previews, generates and uploads image, video and audio nodes,
saved and reloaded through jabrod.com's closed backend.

**Architecture:** Two Next.js apps share one origin (multi-zones). `D:\ansh\jabrod-art` (public
`Jabrod/art`, Apache-2.0) is the studio, with `basePath: "/studio"` on port 3100. jbd_home rewrites
`/studio/**` on the art host to it, and it serves `/api/art/**` with the Neon Auth cookie session,
Vercel Blob, the AI Gateway and credits.

**Tech Stack:**
- Next 16.3.8, React 19.2.0, TypeScript, Tailwind 4, Geist
- `@xyflow/react` 12, `zustand` 5, `vitest`
- jbd_home: `@vercel/blob`, `ai` 7 / `@ai-sdk/gateway` 4, Neon (`sql`), zod

**Spec:** `docs/superpowers/specs/2026-11-12-art-studio-design.md`

## Global Constraints

- No secrets, gateway keys or billing logic in `D:\ansh\jabrod-art`; it talks only to `NEXT_PUBLIC_ART_API` (default `""` = same origin `/api/art`).
- Don't edit jbd_home's homepage, `components/product-site.tsx`, or the signals/evals/context showcases.
- JBD's `/api/ai/*` behaviour must not change.
- Art free allowance: **50 credits / month**, `product_id = 'art'`. Pro (JBD entitlement) falls back to the JBD pool, recorded as `'jbd'`. No PAYG in Art. 1 credit = $0.01 (`creditsFor`).
- Never charge for a failed generation.
- Upload caps: image 20 MB, audio 50 MB, video 500 MB. Board doc ≤ 1 MB.
- Colours:
  - page `#0a090c`, cream `#f3eee2`
  - kinds: image magenta, video blue, audio coral, prompt violet (values from `components/art/paint.tsx`)
  - mono labels `tracking-[0.22em]`
- Reduced motion respected. Fixed node frame sizes (no reflow on media load).
- Commits: author Anshuman only, no co-author trailer.

## Review Focus

1. Signed-out visitor opens /studio → sees a sign-in prompt that returns to /studio, not a crash or a blank canvas.
2. Two tabs editing the same board → the second save gets 409 and reloads, never silently overwriting.
3. A generation fails, or the gateway refuses → the node shows the error, credits are unchanged, and the node can retry.
4. Reload while a video is generating → the node resumes polling from its saved job token.
5. Dropping an unsupported or oversized file → a clear message, and no orphaned node.

---

### Task 1: Studio repo scaffold

**Files:** `package.json`, `next.config.ts` (basePath `/studio`), `tsconfig.json`, `postcss.config.mjs`,
`app/layout.tsx`, `app/globals.css`, `LICENSE` (Apache-2.0), `README.md`, `.gitignore`, `vitest.config.ts`.

- [ ] `npm run dev` serves http://localhost:3100/studio with the Art background and the "jabrod art studio" wordmark.
- [ ] `git init`, author config only, SSH-443 remote `Jabrod/art` (repo created via GitHub MCP, public).

### Task 2: Board model + stores

**Files:** `lib/board.ts`, `lib/store/types.ts`, `lib/store/remote.ts`, `lib/store/local.ts`, `lib/store/index.ts`, `tests/board.test.ts`.

**Produces:**
- `type NodeKind = "prompt" | "note" | "image" | "video" | "audio" | "export"`
- `interface BoardDoc { version: 1; nodes: ArtNode[]; edges: ArtEdge[]; viewport: { x: number; y: number; zoom: number } }`
- `parseBoardDoc(raw: unknown): BoardDoc` (drops runtime fields, defaults empty)
- `promptFor(nodeId: string, doc: Pick<BoardDoc,"nodes"|"edges">): string` (joins the text of connected prompt/note sources, in edge order, then the node's own prompt)
- `interface BoardStore { mode: "remote" | "local"; me(); listBoards(); createBoard(title); getBoard(id); saveBoard(id, doc, title, updatedAt): Promise<{updatedAt} | {conflict:true}>; deleteBoard(id); upload(file, boardId): Promise<Asset>; generate(kind, body): Promise<GenerateResult>; videoStatus(job) }`

- [ ] Tests: `parseBoardDoc` strips `data.playing`/`data.progress`, and rejects a non-object with an empty doc. `promptFor` with two connected prompts returns `"a\n\nb"`.
- [ ] `local` uses IndexedDB (`boards`, `blobs`) and `generate` throws `GenerationUnavailable`.

### Task 3: jbd_home backend

**Files:**
- Create: `db/migrations/007_art.sql`, `lib/platform/art.ts`
- Create: `app/api/art/me/route.ts`, `app/api/art/boards/route.ts`, `app/api/art/boards/[id]/route.ts`, `app/api/art/upload/route.ts`
- Create: `app/api/art/generate/{image,video,speech}/route.ts`, `app/api/art/generate/video/status/route.ts`
- Modify: `lib/platform/models.ts` (add `IMAGE`), `lib/platform/guard.ts` (`SCOPE.art`), `next.config.mjs`

**Produces:** `artSession(): Promise<{ id, email, name } | null>`, `artGate(user): { stop | null, pool: "art"|"jbd", left }`, `storeMedia(bytes|url, kind, userId, boardId, meta): Promise<Asset>`.

**Image models:** `bfl/flux-3-image-klein` $0.009 (default), `meta/muse-image-1.0` $0.01, `bytedance/seedream-4.5` $0.04, `bfl/flux-3-image` $0.048.

- [ ] Migration adds the products row `('art','Jabrod Art')`, schema `art`, `art.boards`, `art.assets` (as in the spec). Run `npm run db:migrate`.
- [ ] next.config: on the art host, rewrite `/studio` and `/studio/:path*` → `${ART_STUDIO_URL ?? "http://localhost:3100"}/studio/...` first. The art catch-all also excludes `studio` and `sign-in`.
- [ ] curl: `/api/art/me` signed out → 401. `/studio` on art.localhost:3000 → studio HTML.

### Task 4: Canvas + nodes

**Files:**
- Pages: `app/page.tsx` (board list), `app/b/[id]/page.tsx`
- Canvas: `components/canvas/Canvas.tsx`, `components/canvas/Palette.tsx`, `components/canvas/TopBar.tsx`, `components/canvas/Inspector.tsx`
- Nodes: `components/nodes/{NodeFrame,PromptNode,NoteNode,ImageNode,VideoNode,AudioNode,ExportNode}.tsx`
- State: `lib/useBoard.ts` (zustand store, undo stack, debounced 800 ms save)

- [ ] Add nodes from the palette, the `/` key, the right-click menu and file drop. Connect nodes, delete, duplicate (Ctrl+D), undo/redo (Ctrl+Z / Ctrl+Shift+Z).
- [ ] Generate buttons show the cost in credits. Video polls every 5 s and resumes on load.
- [ ] Minimap, controls, dot grid; `onlyRenderVisibleElements`.

### Task 5: Verify

- [ ] Both dev servers running. In the browser preview at art.localhost:3000/studio: sign in, create a board, add each kind, upload, generate an image and a voice, connect, reload → same board.
- [ ] Screenshots of each step.
- [ ] `npx vitest run` passes; `npx tsc --noEmit` is clean in the studio and has no new errors in jbd_home.
