import { Suspense } from "react"
import { EditorPage } from "@/components/editor/EditorPage"

export const metadata = { title: "Editor" }

export default function Page() {
  return (
    <Suspense>
      <EditorPage />
    </Suspense>
  )
}
