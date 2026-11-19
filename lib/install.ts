"use client"

/**
 * Installing the Studio as an app (PWA). Chrome, Edge and Android fire `beforeinstallprompt`; we keep
 * it and show our own "Install Studio" button. iOS Safari has no prompt: the button explains Share,
 * then Add to Home Screen. Once the Studio runs installed (standalone), the button goes away.
 * The service worker (public/sw.js) is registered here too.
 */
import { create } from "zustand"

interface PromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

interface InstallState {
  prompt: PromptEvent | null
  installed: boolean
  ios: boolean
  /** true when there is something to offer: a prompt, or iOS steps */
  canOffer: boolean
}

export const useInstall = create<InstallState>(() => ({ prompt: null, installed: false, ios: false, canOffer: false }))


const COUNTED = 'jabrod-art:install-counted'
/** Counts this install once (POST /api/art/installed; needs a signed-in session, so it retries later if not). */
function reportInstall() {
  try {
    if (localStorage.getItem(COUNTED) === '1') return
  } catch {}
  fetch('/api/art/installed', { method: 'POST', credentials: 'include' })
    .then((r) => {
      if (r.ok) {
        try {
          localStorage.setItem(COUNTED, '1')
        } catch {}
      }
    })
    .catch(() => undefined)
}

let started = false

/** Call once on the client (AppShell). */
export function startInstall() {
  if (started || typeof window === "undefined") return
  started = true
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document)
  const safari = ios && !/CriOS|FxiOS|EdgiOS/.test(ua)
  useInstall.setState({ installed: standalone, ios: safari, canOffer: !standalone && safari })
  if (standalone) reportInstall()

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    useInstall.setState({ prompt: e as PromptEvent, canOffer: !useInstall.getState().installed })
  })
  window.addEventListener("appinstalled", () => {
    useInstall.setState({ installed: true, prompt: null, canOffer: false })
    reportInstall()
  })

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/studio/sw.js", { scope: "/studio" }).catch(() => undefined)
  }
}

/** Shows the browser's install dialog. Returns false where there's no prompt (iOS: show steps). */
export async function installNow() {
  const p = useInstall.getState().prompt
  if (!p) return false
  await p.prompt()
  const { outcome } = await p.userChoice
  useInstall.setState({ prompt: null, canOffer: false, installed: outcome === "accepted" })
  return true
}
