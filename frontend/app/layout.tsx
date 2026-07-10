import type React from "react"
import type { Metadata } from "next"
import { Playfair_Display, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Navbar } from "@/components/ui/navbar"
import { Ticker } from "@/components/ui/ticker"
import { CommandPalette } from "@/components/ui/command-palette"
import "./globals.css"
import "./mockup.css"

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" })
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "CongressTracker | Civic intelligence from public records",
  description:
    "Trace legislation, campaign finance, lobbying, disclosures, elections, and congressional relationships back to public sources.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${inter.variable} ${playfair.variable} bg-background text-foreground selection:bg-primary selection:text-primary-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true} disableTransitionOnChange={false}>
          <a className="skip-link" href="#main-content">Skip to content</a>
          <Navbar />
          <Ticker />
          <Suspense fallback={null}>{children}</Suspense>
          <CommandPalette />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
