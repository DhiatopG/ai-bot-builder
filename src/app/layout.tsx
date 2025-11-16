// src/app/layout.tsx
import './globals.css'
import { Providers } from './providers'
import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  // Browser tab + default page title
  title: 'AI Receptionist for Dentists | In60second',
  description:
    'In60second is an AI receptionist for dentists that answers patients 24/7, books appointments, sends reminders, and reduces no-shows.',

  // Helps Next.js build absolute URLs for OG, canonicals, etc.
  metadataBase: new URL('https://in60second.net'),

  // Open Graph (Facebook, LinkedIn, WhatsApp previews)
  openGraph: {
    title: 'AI Receptionist for Dentists | In60second',
    description:
      'Turn your dental website into a 24/7 AI receptionist that books, confirms, and follows up with patients automatically.',
    url: '/',
    siteName: 'In60second',
    type: 'website',
    // When you add an OG image in /public, uncomment this and change the file name:
    // images: ['/og-in60second.jpg'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>
      <body className="bg-white text-black">
        <Providers>
          <Toaster position="top-right" />
          {children}
        </Providers>
      </body>
    </html>
  )
}
