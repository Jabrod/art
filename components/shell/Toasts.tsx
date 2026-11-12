"use client"

import { X } from "lucide-react"
import { useApp } from "@/lib/app-state"

export function Toasts() {
  const { toasts, dismiss } = useApp()
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(380px,calc(100vw-40px))] flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rise pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl ${
            t.tone === "error" ? "border-magenta/30 bg-[#1a0d14]/95" : t.tone === "ok" ? "border-mint/25 bg-[#0d1813]/95" : "border-[var(--line-strong)] bg-ink-3/95"
          }`}
        >
          <span className={`mt-2 size-1.5 shrink-0 rounded-full ${t.tone === "error" ? "bg-magenta" : t.tone === "ok" ? "bg-mint" : "bg-violet"}`} />
          <p className="flex-1 text-cream/90">{t.text}</p>
          <button onClick={() => dismiss(t.id)} className="-mr-1 rounded-lg p-1 text-[var(--faint)] hover:text-cream" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
