"use client"

/**
 * Plans, on the studio page itself: Free and Art Pro with real prices, monthly or yearly, rupees in
 * India and dollars elsewhere. "Get Art Pro" opens Dodo's checkout as an overlay on this page; when
 * payment finishes Dodo returns here with ?subscription_id=…, and AppShell applies it (syncCheckout).
 * Everything listed is what the plans include today; nothing here is a promise about later.
 */
import { useEffect, useRef, useState } from "react"
import { Check, Loader2, X } from "lucide-react"
import { BASE, useApp } from "@/lib/app-state"
import { ART_PRO_PRICES, ArtError, store, type Billing, type Currency, type Interval } from "@/lib/store"

const FREE = [
  "The whole studio: chat, image, video and voice, canvas boards and the Library",
  "50 AI credits every month",
  "JBD, the free video editor for Windows (exports up to 720p with a small mark)",
]

const PRO = [
  "1,000 AI credits every month, for the studio and JBD's AI Director",
  "The AI Director in JBD, Make a reel, silence and filler removal",
  "JBD exports in 1080p and 4K, with no watermark",
  "Every caption style, Hinglish captions in Roman script",
  "Zoom, slide and Ken Burns animations",
  "Use JBD on 2 computers",
]

const money = (minor: number, currency: Currency) =>
  new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100)

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })

/** India by time zone until the server says otherwise (it uses the visitor's country). */
const guessCurrency = (): Currency => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Calcutta" || Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Kolkata" ? "INR" : "USD"
  } catch {
    return "INR"
  }
}

export function PlansDialog() {
  const { plans, closePlans, toast, me } = useApp()
  const [billing, setBilling] = useState<Billing | null | undefined>(undefined)
  const [interval, setInterval] = useState<Interval>("year")
  const [currency, setCurrency] = useState<Currency>(guessCurrency)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!plans.open) return
    setBilling(undefined)
    store
      .billing()
      .then((b) => {
        setBilling(b)
        if (b) setCurrency(b.currency)
      })
      .catch(() => setBilling(null))
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closePlans()
    document.addEventListener("keydown", esc)
    setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 30)
    return () => document.removeEventListener("keydown", esc)
  }, [plans.open, closePlans])

  if (!plans.open) return null

  const prices = billing?.prices ?? ART_PRO_PRICES
  const price = prices[currency][interval]
  const plan = billing?.plan
  const subscribed = Boolean(plan?.subscribed)
  const pro = Boolean(plan?.pro ?? me?.credits?.pro)
  const available = billing ? billing.available[currency][interval] : true
  const local = store.mode === "local"

  async function getPro() {
    setBusy(true)
    try {
      const returnPath = window.location.pathname.startsWith(BASE) ? window.location.pathname : BASE
      const { checkoutUrl } = await store.startCheckout(interval, currency, returnPath)
      if (!/^https:\/\//.test(checkoutUrl)) {
        // older backend: its plan page starts the same checkout
        window.location.href = checkoutUrl
        return
      }
      try {
        const { DodoPayments } = await import("dodopayments-checkout")
        DodoPayments.Initialize({
          mode: billing?.mode === "live" ? "live" : "test",
          displayType: "overlay",
          onEvent: (event) => {
            if (event.event_type === "checkout.error") toast("The checkout ran into a problem. Nothing was charged; try again.", "error")
          },
        })
        closePlans()
        DodoPayments.Checkout.open({ checkoutUrl })
      } catch {
        // the overlay couldn't load: Dodo's own page, which returns to the studio afterwards
        window.location.href = checkoutUrl
      }
    } catch (e) {
      toast(e instanceof ArtError || e instanceof Error ? e.message : "Couldn't start the checkout. Try again.", "error")
    } finally {
      setBusy(false)
    }
  }

  async function manage() {
    setBusy(true)
    try {
      const { url } = await store.billingPortal()
      window.open(url, "_blank", "noopener")
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't open subscription settings.", "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto bg-ink/25 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && closePlans()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="plans-title" className="rise relative w-full max-w-3xl rounded-[28px] border border-[var(--line-strong)] bg-paper-2 p-6 shadow-[var(--lift)] sm:p-8">
        <button onClick={closePlans} className="icon-btn absolute right-4 top-4" aria-label="Close plans">
          <X className="size-4" />
        </button>

        <p className="label">Plans</p>
        <h2 id="plans-title" className="font-display mt-3 text-4xl sm:text-5xl">
          Make more with <span className="brush-underline">Art Pro</span>
        </h2>
        {plans.reason && (
          <p className="mt-4 max-w-xl rounded-2xl border border-[var(--line-strong)] bg-ink/[0.04] px-4 py-3 text-[13.5px] leading-6 text-ink/85">
            {/* the server's message points to the plans page; this dialog is that page */}
            {plans.reason.replace(/\s*\((?:see plans at|upgrade at) [^)]*\)/i, "").replace(/\s*(?:See plans|Upgrade) at \S+, then try again\./i, "")}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-full border border-[var(--line)] p-1 text-[13px]" role="radiogroup" aria-label="Billing">
            {(["month", "year"] as const).map((i) => (
              <button
                key={i}
                role="radio"
                aria-checked={interval === i}
                onClick={() => setInterval(i)}
                className={`rounded-full px-5 py-1.5 transition-colors ${interval === i ? "bg-ink text-paper" : "text-ink/65 hover:text-ink"}`}
              >
                {i === "month" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
          <button onClick={() => setCurrency((c) => (c === "INR" ? "USD" : "INR"))} className="text-[12.5px] text-[var(--muted)] underline underline-offset-4 hover:text-ink">
            {currency === "INR" ? "Show prices in US dollars" : "Show prices in Indian rupees"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Free */}
          <div className="flex flex-col rounded-3xl border border-[var(--line)] bg-ink/[0.015] p-6">
            <p className="text-[15px] font-medium text-ink">Free</p>
            <p className="font-display mt-3 text-4xl">{money(0, currency)}</p>
            <p className="mt-1 text-[12.5px] text-[var(--faint)]">with a Jabrod account</p>
            <ul className="mt-5 flex-1 space-y-2.5 text-[13.5px] leading-5 text-ink/75">
              {FREE.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-ink/40" /> {f}
                </li>
              ))}
            </ul>
            <p className="mt-6 flex h-11 items-center justify-center rounded-full border border-[var(--line)] text-[13px] text-[var(--muted)]">{pro ? "Included in Art Pro" : "Your plan"}</p>
          </div>

          {/* Art Pro */}
          <div className="relative flex flex-col overflow-hidden rounded-3xl border border-[var(--line-strong)] bg-ink/[0.04] p-6">
            <p className="text-[15px] font-medium text-ink">Art Pro</p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="font-display text-4xl">{money(price, currency)}</span>
              <span className="text-[14px] text-[var(--muted)]">/ {interval}</span>
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--faint)]">
              {interval === "year" ? `${money(Math.round(prices[currency].year / 12 / 100) * 100, currency)} a month, billed yearly. ` : ""}
              {currency === "INR" ? "Includes GST." : "Taxes included where they apply."}
            </p>
            <ul className="mt-5 flex-1 space-y-2.5 text-[13.5px] leading-5 text-ink/85">
              {PRO.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-ink/60" /> {f}
                </li>
              ))}
            </ul>

            {subscribed ? (
              <>
                <p className="mt-6 text-[12.5px] leading-5 text-[var(--muted)]">
                  You're on Art Pro{plan?.interval ? ` (${plan.interval === "year" ? "yearly" : "monthly"})` : ""}.
                  {plan?.status === "on_hold" ? " The last payment didn't go through; update your payment method to keep Pro." : plan?.nextBillingAt ? ` It renews on ${date(plan.nextBillingAt)}.` : ""}
                </p>
                <button data-autofocus onClick={manage} disabled={busy} className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-ink/25 text-[14px] text-ink hover:bg-ink/[0.06] disabled:opacity-40">
                  {busy && <Loader2 className="size-4 animate-spin" />} Manage subscription
                </button>
              </>
            ) : (
              <>
                {pro && plan?.until && <p className="mt-6 text-[12.5px] leading-5 text-[var(--muted)]">Your JBD Pro runs until {date(plan.until)} and includes all of this until then. Subscribing now starts billing today.</p>}
                <button
                  data-autofocus
                  onClick={getPro}
                  disabled={busy || local || billing === undefined || !available}
                  className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-medium text-paper transition-colors hover:bg-white disabled:opacity-40"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {local ? "Needs a Jabrod account" : !available ? "Payments open shortly" : `Get Art Pro · ${money(price, currency)} / ${interval}`}
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-[11.5px] leading-5 text-[var(--faint)]">
          Payments are handled by Dodo Payments. Art Pro renews automatically; you can cancel from Manage subscription and keep Pro until the end of the period you paid for.
          {billing?.mode === "test" ? " This is a test environment: no real payments are taken." : ""}
        </p>
      </div>
    </div>
  )
}
