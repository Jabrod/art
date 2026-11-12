"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { AudioLines, Clapperboard, Image as ImageIcon, Library, LayoutGrid, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Search, Trash2, Sparkles } from "lucide-react"
import { pub, useApp } from "@/lib/app-state"
import { store } from "@/lib/store"

const NAV = [
  { href: "/image", label: "Image Studio", icon: ImageIcon, color: "text-magenta" },
  { href: "/video", label: "Video Studio", icon: Clapperboard, color: "text-blue" },
  { href: "/voice", label: "Voice Studio", icon: AudioLines, color: "text-coral" },
  { href: "/boards", label: "Canvas", icon: LayoutGrid, color: "text-violet" },
  { href: "/library", label: "Library", icon: Library, color: "text-cream/70" },
]

function groupByDay(chats: { updatedAt: string }[]) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return (t: string) => {
    const d = new Date(t).getTime()
    if (d >= start) return "Today"
    if (d >= start - 86400000) return "Yesterday"
    if (d >= start - 7 * 86400000) return "Previous 7 days"
    if (d >= start - 30 * 86400000) return "Previous 30 days"
    return "Older"
  }
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { me, chats, chatsLoaded, sidebarOpen, setSidebar, removeChat, toast } = useApp()
  const [q, setQ] = useState("")
  const [searching, setSearching] = useState(false)

  const groups = useMemo(() => {
    const day = groupByDay(chats)
    const list = q ? chats.filter((c) => c.title.toLowerCase().includes(q.toLowerCase())) : chats
    const out: { label: string; items: typeof chats }[] = []
    for (const c of list) {
      const label = day(c.updatedAt)
      const g = out.find((x) => x.label === label)
      if (g) g.items.push(c)
      else out.push({ label, items: [c] })
    }
    return out
  }, [chats, q])

  if (!sidebarOpen) {
    return (
      <div className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-[var(--line)] bg-ink-2 py-3">
        <button onClick={() => setSidebar(true)} className="icon-btn" aria-label="Open sidebar">
          <PanelLeftOpen className="size-4" />
        </button>
        <Link href="/" className="icon-btn" aria-label="New chat">
          <MessageSquarePlus className="size-4" />
        </Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`icon-btn ${pathname.startsWith(n.href) ? "bg-white/[0.07]" : ""}`} aria-label={n.label} title={n.label}>
            <n.icon className={`size-4 ${n.color}`} />
          </Link>
        ))}
      </div>
    )
  }

  const credits = me?.credits
  const pct = credits && credits.limit > 0 ? Math.min(100, (credits.used / credits.limit) * 100) : 0

  return (
    <aside className="flex w-[264px] shrink-0 flex-col border-r border-[var(--line)] bg-ink-2">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <Link href="/" className="flex items-center gap-1.5" aria-label="Jabrod Art Studio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pub("/brand/jabrod-mark.png")} alt="" className="h-6 w-auto" />
          <span className="text-[17px] font-medium lowercase tracking-[-0.03em] text-cream">jabrod</span>
          <span className="label ml-1 !text-[9.5px] !text-cream/50">art</span>
        </Link>
        <div className="flex items-center">
          <button onClick={() => setSearching((s) => !s)} className="icon-btn" aria-label="Search chats">
            <Search className="size-4" />
          </button>
          <button onClick={() => setSidebar(false)} className="icon-btn" aria-label="Close sidebar">
            <PanelLeftClose className="size-4" />
          </button>
        </div>
      </div>

      {searching && (
        <div className="px-3 pb-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="field h-9 w-full text-sm" />
        </div>
      )}

      <nav className="px-2" aria-label="Studio">
        <Link href="/" className={`nav-item ${pathname === "/" ? "nav-active" : ""}`}>
          <MessageSquarePlus className="size-[17px] text-cream/80" /> New chat
        </Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`nav-item ${pathname.startsWith(n.href) || (n.href === "/boards" && pathname.startsWith("/b/")) ? "nav-active" : ""}`}>
            <n.icon className={`size-[17px] ${n.color}`} /> {n.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-3 scroll-thin">
        {chatsLoaded && chats.length === 0 && <p className="px-3 py-2 text-[13px] leading-5 text-[var(--faint)]">Your chats will show up here.</p>}
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <p className="label px-3 pb-1 pt-2 !text-[9.5px]">{g.label}</p>
            {g.items.map((c) => (
              <div key={c.id} className="group relative">
                <Link href={`/c/${c.id}`} className={`block truncate rounded-xl py-2 pl-3 pr-8 text-[13.5px] ${pathname === `/c/${c.id}` ? "bg-white/[0.07] text-cream" : "text-cream/70 hover:bg-white/[0.04] hover:text-cream"}`}>
                  {c.title}
                </Link>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete "${c.title}"? Its messages are deleted too.`)) return
                    try {
                      await store.deleteChat(c.id)
                      removeChat(c.id)
                      if (pathname === `/c/${c.id}`) router.push("/")
                    } catch (e) {
                      toast(e instanceof Error ? e.message : "Couldn't delete the chat.", "error")
                    }
                  }}
                  className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded-lg p-1.5 text-[var(--faint)] hover:text-magenta group-hover:block"
                  aria-label={`Delete ${c.title}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--line)] p-3">
        {credits && store.mode === "remote" && (
          <div className="rounded-2xl border border-[var(--line)] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] text-cream/85">
                <Sparkles className="size-3.5 text-violet" /> {credits.pro ? "JBD Pro" : "Free plan"}
              </span>
              <span className="font-mono text-[11px] text-[var(--faint)]">
                {credits.left}/{credits.limit}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="paint-bg h-full rounded-full transition-[width] duration-500" style={{ width: `${100 - pct}%` }} />
            </div>
            <p className="mt-2 text-[11.5px] text-[var(--faint)]">credits left this month</p>
            {!credits.pro && (
              <a href="https://jabrod.com/jbd/upgrade" target="_blank" rel="noreferrer" className="mt-3 flex h-9 items-center justify-center rounded-xl bg-cream text-[13px] font-medium text-ink hover:bg-white">
                Get 1,000 credits with Pro
              </a>
            )}
          </div>
        )}
        {store.mode === "local" && <p className="rounded-2xl border border-[var(--line)] p-3 text-[12px] leading-5 text-[var(--muted)]">Local mode: boards stay in this browser. AI needs art.jabrod.com.</p>}
        <div className="mt-3 flex items-center gap-2.5 px-1">
          <span className="grid size-8 place-items-center rounded-full bg-violet/25 text-[13px] font-medium uppercase text-cream">{(me?.user?.name ?? "?").slice(0, 1)}</span>
          <div className="min-w-0">
            <p className="truncate text-[13px] text-cream">{me?.user?.name}</p>
            <p className="truncate text-[11px] text-[var(--faint)]">{me?.user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
