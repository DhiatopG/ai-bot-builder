// src/app/cookies/page.tsx
import Link from 'next/link'

export const metadata = {
  title: 'Cookie Notice — In60second',
  description: 'How In60second uses cookies.',
}

export default function CookieNotice() {
  return (
    <div className="min-h-screen bg-white text-blue-900">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-8">
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-900">
            ← Back to Home
          </Link>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">Cookie Notice</h1>
        <p className="text-blue-700 mb-6">
          We use minimal cookies to operate the site and improve reliability. By using In60second, you agree to this notice.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-3">Types of Cookies</h2>
        <ul className="list-disc pl-6 text-blue-700 space-y-2">
          <li><strong>Strictly necessary</strong>: session, security and preference cookies required to run the site.</li>
          <li><strong>Performance</strong>: basic, privacy-friendly analytics to understand usage. We do not sell personal data.</li>
          <li><strong>No advertising cookies</strong> are used.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-3">Managing Cookies</h2>
        <p className="text-blue-700 mb-6">
          You can control or delete cookies in your browser settings. Disabling some cookies may impact site functionality.
          For details on how we handle personal data, see our{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>

        <p className="text-sm text-blue-700">
          Questions? Email <a href="mailto:support@in60second.net" className="underline">support@in60second.net</a>.
        </p>
      </div>
    </div>
  )
}
