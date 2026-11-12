"use client"

import { ChevronDown } from "lucide-react"

/** A native select in the studio's chip style (keyboard and screen-reader friendly for free). */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  icon,
  className = "",
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <label className={`chip relative cursor-pointer pr-7 ${className}`}>
      {icon}
      <span className="sr-only">{label}</span>
      <span className="max-w-[160px] truncate">{options.find((o) => o.value === value)?.label ?? value}</span>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-[var(--faint)]" />
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-3 text-cream">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
