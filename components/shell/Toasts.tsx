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
          className={`rise pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6 shadow-[var(--lift)] ${
            t.tone === "error" ? "border-[var(--line-strong)] bg-paper-2" : t.tone === "ok" ? "border-[var(--line-strong)] bg-paper-2" : "border-[var(--line-strong)] bg-paper-2"
          }`}
        >
          <span className={`mt-2 size-1.5 shrink-0 rounded-full ${t.tone === "error" ? "bg-ink/50" : t.tone === "ok" ? "bg-ink/50" : "bg-ink/50"}`} />
          <p className="flex-1 text-ink/90">{t.text}</p>
          <button onClick={() => dismiss(t.id)} className="-mr-1 rounded-lg p-1 text-[var(--faint)] hover:text-ink" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
