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
      <div className="max-w-3xl mx-auto px-6 py-40 text-gray-800">
        <h1 className="text-3xl font-bold mb-6 text-[#003366] text-center">Privacy Policy</h1>
        <p className="mb-4">
          At <strong>In60second</strong>, we respect your privacy and are committed to protecting your personal data.
          This policy explains what we collect, how we use it, and the choices you have when using our services and
          chatbot.
        </p>

        {/* What we collect */}
        <section id="what-we-collect" className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account data:</strong> name, email, business details you provide.</li>
            <li><strong>Chat &amp; lead data:</strong> messages sent to the bot, lead contact details, appointment choices.</li>
            <li><strong>Service metadata:</strong> IP address, device/browser info, pages visited (for security and analytics).</li>
            <li>
              <strong>Calendar connection (if you connect Google):</strong> access/refresh tokens, Google user ID, and
              calendar IDs needed to create/manage appointments.
            </li>
          </ul>
        </section>

        {/* Google API Services User Data Policy */}
        <section id="google-limited-use" className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">Google OAuth &amp; Calendar Access</h2>
          <p className="mb-2">
            If you choose to connect your Google account, In60second requests only the minimum scopes required to show
            availability and create/reschedule/cancel appointments from the chatbot.
          </p>

          <div className="rounded-xl border p-4">
            <h3 className="font-semibold mb-2">Scopes We Request &amp; Why</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><code>openid</code>, <code>email</code>, <code>profile</code> — authenticate you and link your Google account to your In60second workspace.</li>
              <li><code>https://www.googleapis.com/auth/calendar.freebusy</code> — read <em>free/busy only</em> to compute open time slots (no event details are read).</li>
              <li><code>https://www.googleapis.com/auth/calendar.events.owned</code> — create, update (reschedule), and delete <em>only the appointments created by In60second</em> on calendars you own.</li>
            </ul>
          </div>

          <p className="mt-4">
            <strong>
              Use of information received from Google APIs will adhere to the Google API Services User Data Policy,
              including the Limited Use requirements.
            </strong>
          </p>

          <div className="rounded-xl border p-4 mt-3">
            <h3 className="font-semibold mb-2">Disconnecting &amp; Revoking Access</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                You can disconnect Google anytime at{' '}
                <Link href="/dashboard/calendar" className="text-blue-600 underline">
                  Dashboard &gt; Calendar
                </Link>
                . Select your bot, then click <em>Disconnect Google</em>.
              </li>
              <li>
                You can also revoke access from your Google Account:{' '}
                <a
                  className="text-blue-600 underline"
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  myaccount.google.com/permissions
                </a>.
              </li>
            </ul>
          </div>
        </section>

        {/* How we use data */}
        <section id="how-we-use" className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide and improve the chatbot, booking, and CRM features.</li>
            <li>Compute availability from calendar free/busy and create/manage appointments you request.</li>
            <li>Secure the service, prevent abuse, and troubleshoot issues.</li>
            <li>Communicate service updates and provide support (you can opt out of non-essential emails).</li>
          </ul>
        </section>

        {/* Storage & security */}
        <section id="storage-security" className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">Data Storage &amp; Security</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access and refresh tokens are stored encrypted on our server and never shared or sold.</li>
            <li>We retain account and operational records while your account is active. Backups may persist up to 30 days before permanent removal.</li>
            <li>We use industry-standard encryption in transit and at rest, enforce least-privilege access, and monitor for abuse.</li>
          </ul>
        </section>

        {/* Export & deletion */}
        <section id="export-deletion" className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">Data Export &amp; Deletion</h2>
          <p>
            You can export conversation and lead data from the dashboard at any time. To delete your account and
            associated data, use{' '}
            <Link href="/dashboard/settings#account" className="text-blue-600 underline">
              Dashboard &gt; Settings
            </Link>{' '}
            or email{' '}
            <a href="mailto:support@in60second.net" className="text-blue-600 underline">
              support@in60second.net
            </a>{' '}
            from your registered email. We respond within <strong>1 business day</strong>. For security, we may request additional
            verification.
          </p>
        </section>

        {/* Cookies */}
        <section id="cookies" className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">Cookies &amp; Similar Technologies</h2>
          <p>
            We use essential cookies for authentication and session management, and limited analytics to improve the
            product. You can control cookies in your browser settings.
          </p>
        </section>

        {/* Subprocessors */}
        <section id="subprocessors" className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">Service Providers</h2>
          <p>
            We may use vetted third-party vendors (e.g., hosting, email delivery, analytics) to operate In60second.
            These providers process data on our behalf under contractual confidentiality and security obligations.
          </p>
        </section>

        {/* Contact */}
        <section id="contact" className="space-y-3 mt-10">
          <h2 className="text-xl font-semibold text-[#003366]">Contact Us</h2>
          <p>
            Questions or requests? Email{' '}
            <a href="mailto:support@in60second.net" className="text-blue-600 underline">
              support@in60second.net
            </a>.
          </p>
          <p className="text-sm text-gray-600 mt-2">Last updated: {new Date().toISOString().slice(0, 10)}</p>
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
          <Link href="/terms" className="underline">Terms of Service</Link>
        </p>
      </footer>
    </div>
  )
}
