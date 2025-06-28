import './globals.css'
import { Providers } from './providers'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI SaaS',
  description: 'Create your AI bot in 60 seconds',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-black">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
