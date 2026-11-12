import { Suspense } from "react"
import { StudioPage } from "@/components/studio/StudioPage"

export const metadata = { title: "Video Studio" }

export default function Page() {
  return (
    <Suspense>
      <StudioPage kind="video" />
    </Suspense>
  )
}
