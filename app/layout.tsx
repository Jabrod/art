import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import "@xyflow/react/dist/base.css"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Jabrod Art Studio", template: "%s · Jabrod Art Studio" },
  description: "Chat, generate and edit: images, video and voice on one infinite canvas. Open source, by Jabrod.",
  robots: { index: false },
  icons: { icon: "/studio/icons/icon-192.png", apple: "/studio/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Art Studio", statusBarStyle: "black-translucent" },
}

export const viewport: Viewport = { themeColor: "#0a090c", colorScheme: "dark" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
