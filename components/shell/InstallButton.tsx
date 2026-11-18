"use client"

import { useState } from "react"
import { Download, Share, SquarePlus, X } from "lucide-react"
import { installNow, useInstall } from "@/lib/install"

/** "Install Art Studio": the browser's install dialog, or Add to Home Screen steps on iOS. Hidden once installed. */
export function InstallButton({ className = "btn-ghost" }: { className?: string }) {
  const { canOffer, ios } = useInstall()
  const [steps, setSteps] = useState(false)
  if (!canOffer) return null
  return (
    <>
      <button
        className={className}
        onClick={async () => {
          if (!(await installNow()) && ios) setSteps(true)
        }}
      >
        <Download className="size-3.5" /> Install Art Studio
      </button>
      {steps && (
        <div className="fixed inset-0 z-[95] grid place-items-end bg-ink/25 p-4 sm:place-items-center" onMouseDown={(e) => e.target === e.currentTarget && setSteps(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="ios-install" className="rise w-full max-w-sm rounded-2xl border border-[var(--line-strong)] bg-paper-2 p-5 shadow-[var(--lift-high)]">
            <div className="flex items-center justify-between">
              <p id="ios-install" className="text-[15px] font-medium text-ink">Install Art Studio</p>
              <button className="icon-btn" aria-label="Close" onClick={() => setSteps(false)}>
                <X className="size-4" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-[14px] leading-6 text-ink/85">
              <li className="flex gap-3">
                <Share className="mt-1 size-4 shrink-0 text-ink/60" /> Tap Share in Safari&apos;s toolbar.
              </li>
              <li className="flex gap-3">
                <SquarePlus className="mt-1 size-4 shrink-0 text-ink/60" /> Choose Add to Home Screen, then Add.
              </li>
            </ol>
            <p className="mt-4 text-[12.5px] leading-5 text-[var(--faint)]">Art Studio then opens from your home screen in its own window. It needs a connection to work.</p>
          </div>
        </div>
      )}
    </>
  )
}
