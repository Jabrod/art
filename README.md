# Jabrod Art Studio

Chat, generate and arrange images, video and voice on one infinite canvas. This is the studio behind
[art.jabrod.com/studio](https://art.jabrod.com/studio), by [Jabrod](https://jabrod.com). Apache-2.0.

## What's in it

- **Chat**: a general assistant with your full chat history. When it writes a generation prompt, the
  prompt appears as a card you can send to a board, the Image Studio or the Video Studio.
- **Image, Video and Voice Studios**: a prompt box with the model's options and the credit cost,
  and everything you've made of that kind underneath.
- **Canvas**: boards built from these nodes:
  - Prompt, Note, Image, Video, Audio and Export.
  - Wire a prompt into a generator, drop or paste in your own files, and connect media into
    Export to download it for JBD (Jabrod's free video editor for Windows).
  - Undo and redo, autosave, minimap and keyboard shortcuts (P I V A N E add nodes; Ctrl+D
    duplicates).
- **Library**: every file you've uploaded or generated.

## Run it

```bash
npm install
npm run dev        # http://localhost:3100/studio
npm test           # board model tests
```

On its own, the studio runs in **local mode**:
- Boards and files stay in your browser (IndexedDB).
- AI generation and chat are switched off, because they need a backend.

On Jabrod's art host, the studio uses jabrod.com's `/api/art` on the same origin. That backend
holds Jabrod accounts, the AI gateway and credits, and it isn't part of this repository. To point
the studio at another backend with the same API, set `NEXT_PUBLIC_ART_API`
(`lib/store/types.ts` describes the interface).

## How it fits together

- **Same address as art.jabrod.com:** it's a Next.js app with `basePath: "/studio"` (a
  multi-zone). jabrod.com's app rewrites `art.jabrod.com/studio/**` to it.
- **`lib/board.ts`:** the versioned board document, and how prompts flow along edges.
- **`lib/useBoard.ts`:** the open board, with undo/redo and autosave. A save conflict reloads the
  latest version.
- **`lib/store/`:** the backend interface, with `remote` (Jabrod) and `local` (IndexedDB)
  versions.
- **`components/canvas/`:** the React Flow canvas, the nodes and the settings panel.
