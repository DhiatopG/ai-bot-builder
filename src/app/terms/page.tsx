'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="relative">
      {/* Logo Top Left */}
      <div className="absolute top-6 left-6">
        <Image src="/logo.png" alt="In60second Logo" width={160} height={50} />
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-40 text-gray-800 text-center">
        <h1 className="text-3xl font-bold mb-6 text-[#003366]">Terms of Service</h1>
        <p className="mb-4">
          By using In60second, you agree to our terms. We provide AI chatbot tools "as is" and are not liable for any misuse or data loss.
        </p>
        <p className="mb-4">
          You may not resell, duplicate, or exploit our product without permission. We may suspend access if these terms are violated.
        </p>
        <p className="mb-4">
          We may update these terms occasionally. Continued use means you accept the updated version.
        </p>
      </div>

      {/* Footer */}
      <footer className="bg-[#003366] text-white text-center py-10">
        <p>© 2025 In60second</p>
        <p className="mt-2">
          <Link href="/" className="underline">Home</Link> |{' '}
          <Link href="/about" className="underline">About</Link> |{' '}
          <Link href="/contact" className="underline">Contact</Link> |{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link> |{' '}
          <Link href="/terms" className="underline">Terms of Service</Link>
        </p>
      </footer>
    </div>
  )
}
