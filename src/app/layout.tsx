import './globals.css'

import { Providers } from './providers'

export const metadata = {
  title: 'AI SaaS',
  description: 'Create your AI bot in 60 seconds',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
