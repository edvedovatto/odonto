import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Vedo",
  description: "Agenda da clínica Vedo",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vedo",
  },
  icons: {
    icon: "/icon.jpeg",
    apple: "/icon.jpeg",
  },
}

export const viewport: Viewport = {
  themeColor: "#4338ca",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="h-full bg-background text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
