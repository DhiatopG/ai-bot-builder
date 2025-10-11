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
      <div className="max-w-3xl mx-auto px-6 py-40 text-gray-800">
        <h1 className="text-3xl font-bold mb-6 text-[#003366] text-center">Terms of Service</h1>
        <p className="text-center text-sm text-gray-600 mb-8">
          Effective date: {new Date().toISOString().slice(0, 10)}
        </p>

        <p className="mb-4">
          Welcome to <strong>In60second</strong>. By accessing or using our website, products, and services
          (collectively, the “Service”), you agree to these Terms of Service (“Terms”). If you do not agree, do not use the Service.
        </p>

        {/* 1. Eligibility & Accounts */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">1. Eligibility & Accounts</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You must be at least 18 years old and have authority to bind your organization.</li>
            <li>You are responsible for your account credentials and all activity under your account.</li>
            <li>Provide accurate account information and keep it up to date.</li>
          </ul>
        </section>

        {/* 2. Use of the Service (Acceptable Use) */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">2. Use of the Service</h2>
          <p>The Service provides AI-assisted chat, lead capture, and calendar booking tools for businesses.</p>
          <h3 className="font-medium">Acceptable Use</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>No unlawful, harmful, deceptive, harassing, or infringing activity.</li>
            <li>No spam or unsolicited messages; comply with applicable marketing and consent laws (e.g., CAN-SPAM, TCPA where applicable).</li>
            <li>No security testing, reverse engineering, or interference with the Service.</li>
            <li>No uploading or processing content you lack rights to share.</li>
          </ul>
          <p className="text-sm text-gray-600">
            We may suspend or terminate accounts that violate these Terms or our policies.
          </p>
        </section>

        {/* 3. Subscriptions, Billing & Trials */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">3. Subscriptions, Billing & Trials</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Paid plans bill in advance on a recurring basis until canceled.</li>
            <li>Taxes and payment processing fees may apply depending on your location.</li>
            <li>Trials or promotions may change or be withdrawn at any time.</li>
          </ul>
          <p>
            Refunds are governed by our{' '}
            <Link href="/refunds" className="underline text-blue-600">Refund Policy</Link>.
          </p>
        </section>

        {/* 4. Cancellation */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">4. Cancellation</h2>
          <p>
            You can cancel anytime in your dashboard. Cancellations take effect at the end of the current billing period; you will retain access until then.
          </p>
        </section>

        {/* 5. Customer Data, Privacy & Google APIs */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">5. Customer Data, Privacy & Google APIs</h2>
          <p>
            “Customer Data” means information you or your users submit to the Service (e.g., chats, leads, appointment details).
            You retain ownership of Customer Data. You grant us a limited license to process Customer Data solely to provide, maintain, and improve the Service.
          </p>
          <p>
            We handle personal data under our{' '}
            <Link href="/privacy" className="underline text-blue-600">Privacy Policy</Link>.
            If you connect Google Calendar, our access and use of data obtained via Google APIs will adhere to the
            <strong> Google API Services User Data Policy, including the Limited Use requirements</strong>.
            See the Privacy Policy for details on scopes, storage, and revocation.
          </p>
        </section>

        {/* 6. Third-Party Services */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">6. Third-Party Services</h2>
          <p>
            The Service may integrate with third parties (e.g., Google, email, telephony). Your use of those services is governed by their terms and privacy policies.
            We are not responsible for third-party services.
          </p>
        </section>

        {/* 7. Intellectual Property */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">7. Intellectual Property</h2>
          <p>
            We own the Service and all related intellectual property. Subject to these Terms, we grant you a limited, non-exclusive,
            non-transferable license to access and use the Service for your business. You may not copy, modify, resell, or create derivative works of the Service.
          </p>
          <p className="text-sm text-gray-600">
            Product feedback is welcome; by submitting suggestions, you grant us a license to use them.
          </p>
        </section>

        {/* 8. Availability & Support */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">8. Availability & Support</h2>
          <p>
            We aim for high availability but do not guarantee uninterrupted service. Maintenance and outages may occur.
            Support is available via{' '}
            <a href="mailto:support@in60second.net" className="text-blue-600 underline">support@in60second.net</a>.
          </p>
        </section>

        {/* 9. Disclaimers */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">9. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED,
            INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            The Service is not a substitute for professional medical, legal, or compliance advice and is not for emergency use.
          </p>
        </section>

        {/* 10. Limitation of Liability */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN60SECOND AND ITS AFFILIATES WILL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR GOODWILL.
            OUR TOTAL LIABILITY FOR ANY CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE AMOUNTS YOU PAID FOR THE SERVICE
            IN THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM.
          </p>
        </section>

        {/* 11. Indemnification */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">11. Indemnification</h2>
          <p>
            You will indemnify and hold In60second harmless from claims arising out of your use of the Service or violation of these Terms.
          </p>
        </section>

        {/* 12. Termination */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">12. Termination</h2>
          <p>
            We may suspend or terminate the Service or your access if you violate these Terms or create risk or legal exposure for us.
            Upon termination, your right to use the Service ends immediately. Certain provisions survive termination (e.g., IP, disclaimers, liability limits, indemnity).
          </p>
        </section>

        {/* 13. Governing Law & Disputes */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">13. Governing Law & Dispute Resolution</h2>
          <p>
            These Terms are governed by the laws of the State of <strong>Montana, USA</strong>, without regard to conflict-of-laws rules.
            Courts located in Montana will have exclusive jurisdiction, unless we mutually agree to arbitration.
          </p>
        </section>

        {/* 14. Changes */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">14. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will be posted on this page.
            Your continued use of the Service after changes become effective constitutes acceptance.
          </p>
        </section>

        {/* 15. Contact */}
        <section className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">15. Contact</h2>
          <p>
            Questions about these Terms? Email{' '}
            <a href="mailto:support@in60second.net" className="text-blue-600 underline">support@in60second.net</a>.
          </p>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-[#003366] text-white text-center py-10">
        <p>© {new Date().getFullYear()} In60second</p>
        <p className="mt-2">
          <Link href="/" className="underline">Home</Link> |{' '}
          <Link href="/about" className="underline">About</Link> |{' '}
          <Link href="/contact" className="underline">Contact</Link> |{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link> |{' '}
          <Link href="/terms" className="underline">Terms of Service</Link> |{' '}
          <Link href="/refunds" className="underline">Refund Policy</Link>
        </p>
      </footer>
    </div>
  )
}
