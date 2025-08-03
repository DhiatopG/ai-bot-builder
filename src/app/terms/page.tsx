'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold mb-6 text-[#003366]">Terms of Service</h1>

        <p className="mb-4">
          Welcome to In60second. By accessing or using our platform, you agree to be bound by these Terms of Service.
        </p>

        <p className="mb-4">
          Our platform provides AI-powered chatbot tools for small businesses and service providers. All content and functionality are provided "as is" without any warranty.
        </p>

        <p className="mb-4">
          You may not copy, resell, redistribute, or sublicense any part of our services without written permission. Misuse, abuse, or unauthorized use of the platform may result in account suspension or termination.
        </p>

        <p className="mb-4 font-semibold text-[#003366]">Refund Policy</p>
        <p className="mb-4">
          We offer refunds within 7 days of purchase if you are unsatisfied with the service or experience technical issues we cannot resolve. To request a refund, please contact us at{' '}
          <a href="mailto:support@in60second.net" className="underline text-blue-600">support@in60second.net</a>. Refunds are processed back to your original payment method.
        </p>

        <p className="mb-4 font-semibold text-[#003366]">Modifications</p>
        <p className="mb-4">
          We reserve the right to update or modify these terms at any time. Your continued use of the platform constitutes acceptance of any changes.
        </p>

        <p className="mb-4 font-semibold text-[#003366]">Limitation of Liability</p>
        <p className="mb-4">
          In60second will not be held liable for any indirect, incidental, or consequential damages arising from the use or inability to use the service.
        </p>

        <p className="mb-4 font-semibold text-[#003366]">Governing Law</p>
        <p className="mb-4">
          These Terms are governed by the laws of the State of Montana, United States.
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
