"use client"

import { memo, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, Copy } from "lucide-react"

export function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1400)
        })
      }}
      className={`icon-btn !size-7 ${className}`}
      aria-label="Copy"
      title="Copy"
    >
      {done ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
    </button>
  )
}

/**
 * Chat Markdown. ```prompt blocks are generation prompts the assistant wrote; `renderPrompt` turns
 * them into cards with studio actions. Other code blocks get a language label and a copy button.
 */
export const Markdown = memo(function Markdown({ text, renderPrompt }: { text: string; renderPrompt?: (prompt: string) => React.ReactNode }) {
  return (
    <div className="prose-art">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const lang = /language-([\w-]+)/.exec(className ?? "")?.[1]
            const raw = String(children ?? "")
            const block = Boolean(lang) || raw.includes("\n")
            if (!block) return <code>{children}</code>
            const content = raw.replace(/\n$/, "")
            if (lang === "prompt" && renderPrompt) return <>{renderPrompt(content)}</>
            return (
              <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-black/30">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-1">
                  <span className="label !text-[9.5px]">{lang ?? "text"}</span>
                  <CopyButton text={content} />
                </div>
                <pre className="overflow-x-auto p-3 scroll-thin">
                  <code>{content}</code>
                </pre>
              </div>
            )
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})
