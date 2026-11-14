"use client"

import { useEffect } from "react"
import { useApp, pub } from "@/lib/app-state"
import { store } from "@/lib/store"
import { PlansDialog } from "./PlansDialog"
import { Sidebar } from "./Sidebar"
import { Toasts } from "./Toasts"

/** The studio frame: sidebar, the page, toasts. Signed-out visitors see the sign-in screen. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { me, meError, loadMe, loadChats, loadModels } = useApp()

  useEffect(() => {
    loadMe()
    loadModels()
  }, [loadMe, loadModels])

  useEffect(() => {
    if (me?.signedIn) loadChats()
  }, [me?.signedIn, loadChats])

  // /studio?plans opens the plans dialog (links from JBD, emails, the website).
  useEffect(() => {
    if (!me?.signedIn) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has("plans")) return
    url.searchParams.delete("plans")
    window.history.replaceState(null, "", url.pathname + url.search + url.hash)
    useApp.getState().openPlans()
  }, [me?.signedIn])

  // Back from Dodo's checkout (?subscription_id=…&status=…): apply it, say so, tidy the address.
  useEffect(() => {
    if (!me?.signedIn) return
    const url = new URL(window.location.href)
    const sub = url.searchParams.get("subscription_id")
    if (!sub) return
    for (const k of ["subscription_id", "status", "payment_id", "email", "license_key"]) url.searchParams.delete(k)
    window.history.replaceState(null, "", url.pathname + (url.search === "?" ? "" : url.search) + url.hash)
    const { toast } = useApp.getState()
    store
      .syncCheckout(sub)
      .then(({ status }) => {
        if (status === "active") toast("You're on Art Pro. Your 1,000 monthly AI credits are ready.", "ok")
        else toast("The payment didn't go through. Nothing was charged; you can try again from See plans.", "error")
        loadMe()
      })
      .catch(() => toast("Couldn't confirm the payment yet. If you paid, Pro switches on within a minute.", "info"))
  }, [me?.signedIn, loadMe])

  if (meError) return <Centered title="Can't reach Jabrod" body={meError} action={<button className="btn-primary" onClick={() => loadMe()}>Try again</button>} />
  if (!me) return <Loading />
  if (!me.signedIn) return <SignIn href={me.signInUrl ?? "/sign-in?next=/studio"} />

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-paper">
      <Sidebar />
      <main className="relative min-w-0 flex-1">{children}</main>
      <PlansDialog />
      <Toasts />
    </div>
  )
}

function Loading() {
  return (
    <div className="grid h-dvh place-items-center bg-paper" aria-busy="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pub("/brand/jabrod-mark.png")} alt="" className="mark-ink h-8 w-auto animate-pulse opacity-70 motion-reduce:animate-none" />
    </div>
  )
}

function Centered({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="grid h-dvh place-items-center bg-paper px-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-3xl">{title}</h1>
        <p className="mt-3 text-[15px] leading-7 text-[var(--muted)]">{body}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  )
}

function SignIn({ href }: { href: string }) {
  return (
    <div className="relative grid h-dvh place-items-center overflow-hidden bg-paper px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pub("/brand/jabrod-art-intro-poster.webp")} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 blur-[2px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--color-paper)_70%)]" />
      <div className="rise relative max-w-lg text-center">
        <div className="flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pub("/brand/jabrod-mark.png")} alt="Jabrod" className="mark-ink h-8 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pub("/brand/art-wordmark.png")} alt="Art" className="-mt-1 h-8 w-auto" />
        </div>
        <p className="label mt-8">Art Studio</p>
        <h1 className="font-display mt-4 text-5xl sm:text-6xl">
          Generate. <span className="brush-underline">Edit.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-sm text-[15px] leading-7 text-[var(--muted)]">
          Images, video and voice, together on one canvas.
        </p>
        <a href={href} className="btn-primary mt-8 inline-flex">Sign in to Jabrod</a>
        <p className="mt-4 text-xs text-[var(--faint)]">Free every month: 50 AI credits. Open source on GitHub.</p>
      </div>
    </div>
  )
}
