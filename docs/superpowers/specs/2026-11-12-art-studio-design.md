# Jabrod Art Studio — v1 design

Date: 2026-11-12 · Status: draft for Anshuman's approval

## Intent

Jabrod Art should be a usable product, not only a marketing site. The studio is an
infinite canvas at **art.jabrod.com/studio** where you generate or import images, video
clips and voice/audio, arrange them, and wire them into a flow: idea → generate → edit →
export. Video edits go on to JBD. The promise is "Generate. Edit." / "Make anything."

The studio is open source (Apache-2.0, like the rest of Art). Accounts, the AI gateway,
credits and billing stay closed in jabrod.com (`D:\ansh\jbd_home`).

## Decisions made with Anshuman

- **Repo:** a new public repo from day one, **`Jabrod/art`** (name to confirm), local
  checkout `D:\ansh\jabrod-art`. Nothing is created on GitHub without a fresh yes.
- **Credits:** Art gets its **own free monthly allowance** so anyone signed in can try
  generation. JBD Pro credits sit on top of it.
- **Canvas library:** **React Flow (`@xyflow/react`, MIT)**.

## Goals (v1)

1. A signed-in person opens art.localhost:3000/studio (art.jabrod.com/studio in
   production) and sees their boards. They can create, rename and delete a board.
2. On a board's full-screen canvas, they add nodes:
   - **Prompt**: text, the "idea".
   - **Image**: generated through the gateway from a typed or connected prompt, or uploaded.
   - **Video**: generated through the gateway (async job, polled), or uploaded.
   - **Audio**: a voice made through the gateway (text to speech), or an uploaded audio file.
   - **Note**: plain text for annotating the board.
   - **Export**: collects the media wired into it. It offers downloads and the JBD handoff.
3. Edges connect nodes. A Prompt connected into a generator fills that generator's prompt.
   Media is previewed inline: images render; video and audio have play/pause and scrub.
4. The board saves automatically (debounced) and comes back exactly on reload: nodes,
   edges, media and viewport.
5. Feel: 60 fps pan and zoom with many nodes, no layout jank while media loads,
   `prefers-reduced-motion` respected. There's a minimap, fit-to-view, keyboard shortcuts
   (delete, duplicate, undo/redo, space-drag) and drag-and-drop of files onto the canvas.
6. Verified in the browser preview with screenshots.

## Non-goals (v1)

- Real-time multiplayer and shared boards.
- Editing pixels or timelines on the canvas (crop, trim, filters). JBD does editing.
- Templates, a public gallery and sharing links.
- Pay-as-you-go for Art (JBD's PAYG stays JBD's).
- A one-click "Open in JBD" deep link. JBD has no URL handler today, so that is a JBD change
  (follow-up). In v1 the Export node downloads the media and points to JBD.

## Anti-goals (would make it a failure even if it works)

- Secrets, gateway keys or billing logic in the public repo.
- A canvas that stutters on pan/zoom, or nodes that jump size while media loads.
- Off-brand UI (generic SaaS grey or shadcn defaults) instead of the Art look.
- Charging credits for failed generations.

## Architecture

### Two apps, one origin (Next.js multi-zones)

```
art.jabrod.com (or art.localhost:3000)
  /                 → jbd_home app/art-site    (marketing, closed repo, unchanged)
  /studio/**        → Jabrod/art app            (open source, basePath "/studio")
  /api/art/**       → jbd_home app/api/art      (closed: auth, boards, uploads, AI, credits)
  /api/auth/**      → jbd_home Neon Auth proxy  (session cookie on the art host)
  /sign-in          → jbd_home sign-in page
```

- The studio is its own Next.js app (same Next major as jbd_home; read
  `node_modules/next/dist/docs/01-app/02-guides/multi-zones.md` first) with
  `basePath: "/studio"`, running on port **3100** in development.
- jbd_home's `next.config.mjs` adds a `beforeFiles` rewrite on the art host:
  `/studio` and `/studio/:path*` → `${ART_STUDIO_URL}/studio/:path*`. `ART_STUDIO_URL`
  defaults to `http://localhost:3100` in dev; in production it's the studio's Vercel URL.
  The existing art-host catch-all must also skip `studio` and `sign-in`, so
  `art.jabrod.com/sign-in` is the real sign-in page and the Neon Auth cookie lands on the
  art host.
- Because everything shares one origin, the studio calls relative `/api/art/*` with the
  session cookie: no CORS and no new OAuth flow. Self-hosters set
  `NEXT_PUBLIC_ART_API` to point at another backend.

### Open-source studio (`Jabrod/art`)

- Next.js + React 19 + TypeScript, Tailwind 4, Geist, `@xyflow/react`, `zustand` (canvas
  state + undo history), `motion` for small UI transitions only.
- `lib/store/`: a `BoardStore` interface with two implementations:
  - `remote`: the `/api/art/*` client, used on art.jabrod.com.
  - `local`: IndexedDB, with media kept as Blobs. Used when no API is configured, so
    `git clone && npm run dev` works for anyone with no secrets. Generation is disabled
    in local mode, with an honest message saying so.
- `lib/board.ts`: the versioned board document,
  `{ version: 1, nodes, edges, viewport }`. Node `data` holds only serialisable fields
  (asset URL, prompt, model, status, size). Runtime state (playing, progress) never goes
  into the document.
- Nodes have **fixed frame sizes** set from the media's aspect ratio when it's known, so
  nothing reflows as media loads. Video and audio elements use `preload="metadata"`. Each
  media element mounts only while its node is near the viewport (React Flow
  `onlyRenderVisibleElements`), so a board with many clips stays light.
- Generation jobs are polled per node. A board can be closed mid-job: the node keeps its
  job token and resumes polling on reload.
- `LICENSE` (Apache-2.0), `README` (what it is, run locally, self-host notes), and
  `CONTRIBUTING`.

### Closed backend (jbd_home, `app/api/art/*`, `lib/platform/art.ts`)

Session = the Neon Auth cookie (`getAuth().getSession()` in route handlers). Each route
answers 401 when signed out.

- `GET /api/art/me` → `{ user, credits: { used, limit }, jbd: { hasDevice } }`.
  `hasDevice` comes from `platform.device_sessions` and switches the Export node between
  "Open JBD" and "Download JBD".
- `GET/POST /api/art/boards`, and `GET/PUT/DELETE /api/art/boards/:id`. PUT carries the
  `updated_at` the client last saw; on a mismatch it returns 409 (another tab saved), and
  the client reloads that board.
- `POST /api/art/upload`: a Vercel Blob client-upload token (`@vercel/blob`
  `handleUpload`, `BLOB_READ_WRITE_TOKEN`) limited to image/video/audio types and size
  caps (image 20 MB, audio 50 MB, video 500 MB). It records an `art.assets` row when
  the upload completes.
- `POST /api/art/generate/image` (new: `generateImage` through `@ai-sdk/gateway`, with an
  `IMAGE` model list added to `lib/platform/models.ts`). The result is stored to Blob and
  recorded as an asset.
- `POST /api/art/generate/video` + `GET /api/art/generate/video/status`: reuse the
  `/api/ai/video` logic (model checks, `video-jobs.ts` signed job, refund on failure). The
  finished clip is copied to Blob, because gateway URLs expire.
- `POST /api/art/generate/speech`: reuse the `/api/ai/speech` logic; audio is stored to Blob.
- Shared helpers are factored out of the existing JBD routes, so JBD's behaviour stays
  exactly the same. All AI calls go through `tooFast` rate limiting and record
  `platform.usage_events` with `product_id = 'art'`, and nothing is charged on failure.
- A scope/safety system prompt for Art in `guard.ts` (`SCOPE.art`) wherever text models
  are used, plus the gateway's own content filters for image/video.

### Credits

- New `platform.products` row: `('art', 'Jabrod Art')`.
- Art allowance: **50 credits a month free** (≈ $0.50 of provider cost: a handful of
  images and a few seconds of video). *(My call; you may want a different number.)*
- JBD Pro members also get **their remaining JBD Pro credits once the Art allowance is
  spent**: the Art gate checks Art usage first, then falls back to the JBD pool and
  records that spend under `product_id = 'jbd'` so JBD's numbers stay true. No PAYG in Art.
- The studio shows credits left in the top bar, and the cost of a generation on the
  button before you press it.

### Data (migration `db/migrations/007_art.sql`, schema `art`)

```
art.boards (id uuid pk, user_id text, title text, doc jsonb, thumbnail_url text,
            created_at, updated_at)            index (user_id, updated_at desc)
art.assets (id uuid pk, user_id text, board_id uuid null, kind text check in
            ('image','video','audio'), url text, bytes bigint, width int, height int,
            duration_ms int, source text check in ('upload','generated'),
            meta jsonb, created_at)
```

Board docs are capped at 1 MB. Media lives in Blob; the doc stores only URLs and asset ids.

## Design

- Page `#0a090c`, with cream `#f3eee2` for the lowercase "jabrod" mark and primary text.
  The ART paint colours (magenta / violet / blue / coral, taken from `components/art/paint.tsx`)
  mark node kinds: image = magenta, video = blue, audio = coral, prompt = violet.
  Mono labels use spaced caps (`tracking-[0.22em]`). Headlines use `.font-display`
  (Geist 500, −0.04em), per `docs/design-system.md`.
- The canvas background is a faint dot grid that scales with zoom. Nodes are dark glass
  cards (`white/[0.03]`, `white/[0.08]` border, `rounded-2xl`), with a coloured hairline
  in their kind's colour. Edges are thin cream curves; an edge glows while its target
  node is generating. With reduced motion there is no glow animation.
- Layout:
  - Top bar: board title, save state, credits, account.
  - Left rail: the add-node palette (also on right-click and the `/` key).
  - Bottom right: zoom controls + minimap.
  - Selecting a node opens its inspector panel (model, settings, cost).

## Left to the builder

- Exact image models (pick 2–3 the gateway serves today; verify by calling it).
- Shortcut keys beyond those listed, empty states, the board list's look.
- Thumbnail generation for the board list (client-side snapshot of the viewport on save
  is fine).
- Whether undo/redo is per session only (fine for v1).

## Verification

- The studio runs at art.localhost:3000/studio, through the jbd_home dev server on :3000
  and the studio on :3100.
- In the browser preview:
  - Sign in. Create a board. Add each node kind.
  - Upload an image, a video and an audio file. Generate one image and one voice line
    (and one short video if credits allow). Connect a prompt to a generator.
  - Pan and zoom, then reload and confirm the board comes back unchanged.
  - Screenshot each step.
- JBD's routes behave the same: `/api/ai/video` and `/api/ai/speech` are unchanged, or
  they're refactored without any change in behaviour.
- Commits carry only Anshuman's name, with no co-author trailer.

## Follow-ups (not v1)

- JBD URL handler (`jbd://open?board=…`) so Export can open media directly in JBD.
- Image → video (first frame) and video → audio (soundtrack) connections that pass media,
  not just prompts.
- Sharing and a public gallery; templates.
