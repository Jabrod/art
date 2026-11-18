# Editor build

This folder is JBD's web editor, built from the public repository github.com/Jabrod/jbd
(`apps/filmcraft-web`, Apache-2.0) at commit a7478db with `cargo xtask web` (release, wasm-bindgen 0.2.129).
The only change is the loading text in index.html. To update it, rebuild there and copy
`target/web/dist/*` here. The studio drives it through `window.filmcraft` (components/editor/EditorPage.tsx).
