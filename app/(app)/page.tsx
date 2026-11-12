"use client"

import { usePathname } from "next/navigation"
import { ChatView } from "@/components/chat/ChatView"

/** New chat. Sending the first message moves the address to /c/<id> without remounting. */
export default function NewChatPage() {
  const pathname = usePathname()
  return <ChatView key={pathname === "/" ? "new" : pathname} />
}
