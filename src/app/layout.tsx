// src/app/layout.tsx
import './globals.css'
import { Providers } from './providers'
import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  // Browser tab + default page title
  title: 'In60second | AI Dental Receptionist & 24/7 Answering Service for Dentists',
  description:
    'In60second is an AI dental receptionist and 24/7 answering service for dentists that answers patients, books appointments, sends reminders, and helps reduce no-shows.',

  // Optional but nice to have
  keywords: [
    'AI dental receptionist',
    '24/7 answering service for dentists',
    'reduce no-shows dental practice',
    'dental chatbot for website',
    'missed calls dental office',
    'In60second',
  ],

  // Helps Next.js build absolute URLs for OG, canonicals, etc.
  metadataBase: new URL('https://in60second.net'),

  // Open Graph (Facebook, LinkedIn, WhatsApp previews)
  openGraph: {
    title: 'In60second | AI Dental Receptionist & 24/7 Answering Service for Dentists',
    description:
      'Turn your dental website into a 24/7 AI dental receptionist that answers patients, books and confirms appointments, and reduces no-shows automatically.',
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
