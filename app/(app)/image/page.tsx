import { Suspense } from "react"
import { StudioPage } from "@/components/studio/StudioPage"

export const metadata = { title: "Image Studio" }

export default function Page() {
  return (
    <Suspense>
      <StudioPage kind="image" />
    </Suspense>
  )
}
