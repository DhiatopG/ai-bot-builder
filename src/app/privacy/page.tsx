'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function PrivacyPolicy() {
  return (
    <div className="relative">
      {/* Logo Top Left */}
      <div className="absolute top-6 left-6">
        <Image
          src="/logo.png"
          alt="In60second Logo"
          width={160}
          height={50}
          style={{ width: 'auto', height: 'auto', maxWidth: '120px' }}
        />
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-40 text-gray-800 text-center">
        <h1 className="text-3xl font-bold mb-6 text-[#003366]">Privacy Policy</h1>
        <p className="mb-4">
          At In60second, we respect your privacy and are committed to protecting your personal data.
          This policy explains how we handle your information when you use our services.
        </p>
        <p className="mb-4">
          We collect basic information like your name and email to provide AI chatbot functionality and
          CRM integration. This data is securely stored and never sold.
        </p>
        <p className="mb-4">
          If you have any questions or want your data removed, contact us at:{' '}
          <a href="mailto:support@in60second.net" className="text-blue-600 underline">
            support@in60second.net
          </a>
        </p>

        {/* Added: Data Export & Deletion */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">Data Export & Deletion</h2>
          <p>
            You can export your conversation and lead data from the dashboard at any time. To delete your account and
            associated data, email{' '}
            <a href="mailto:support@in60second.net" className="text-blue-600 underline">
              support@in60second.net
            </a>{' '}
            from your registered email. We respond within <strong>1 business day</strong>.
          </p>
          <p>
            For security, we may request additional verification before completing a deletion request.
            Backup copies may persist for up to 30 days in encrypted storage before permanent removal.
          </p>
        </section>
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
