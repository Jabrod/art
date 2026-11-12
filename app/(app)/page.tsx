"use client"

import { ChatView } from "@/components/chat/ChatView"
import { useApp } from "@/lib/app-state"

/**
 * New chat. Sending the first message moves the address to /c/<id> with history.replaceState,
 * so this view stays mounted while the reply streams. "New chat" bumps chatNonce to start over.
 */
export default function NewChatPage() {
  const nonce = useApp((s) => s.chatNonce)
  return <ChatView key={nonce} />
}
