// src/app/refunds/page.tsx
import Link from 'next/link'

export const metadata = {
  title: 'Refund Policy — In60second',
  description: 'Refunds and cancellations for In60second plans.',
}

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-white text-blue-900">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-8">
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-900">← Back to Home</Link>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">Refund Policy</h1>
        <p className="text-blue-700 mb-8">Last updated: 08 Aug 2025</p>

        <p className="text-blue-700 mb-6">
          We want you to be happy with In60second. This policy explains when refunds are available for
          subscriptions and one-time purchases. Our service is intended for business use (“B2B”). If your
          local laws grant you additional rights, we will honor them.
        </p>

        {/* Trials */}
        <h2 className="text-2xl font-semibold mt-10 mb-3">Free Trial</h2>
        <p className="text-blue-700 mb-4">
          If a free trial is offered without payment details, you won’t be charged during the trial.
          If you add a paid plan after the trial, normal refund windows below apply from the first charge.
        </p>

        {/* Monthly */}
        <h2 className="text-2xl font-semibold mt-10 mb-3">Monthly Plans</h2>
        <p className="text-blue-700 mb-4">
          Refunds for first-time monthly purchases are available within <span className="font-semibold">72 hours</span> of the charge
          if usage is light: fewer than <span className="font-semibold">20 conversations</span> or <span className="font-semibold">500 assistant messages</span> across all
          assistants on the account, and no data export has been performed.
        </p>
        <p className="text-blue-700 mb-4">
          Renewals of monthly plans are non-refundable. You can cancel anytime to stop the next month’s billing.
        </p>

        {/* Annual */}
        <h2 className="text-2xl font-semibold mt-10 mb-3">Annual Plans</h2>
        <p className="text-blue-700 mb-4">
          Refunds for first-time annual purchases are available within <span className="font-semibold">14 days</span> of the charge
          if usage is light: fewer than <span className="font-semibold">100 conversations</span> or <span className="font-semibold">2,500 assistant messages</span>, and no data
          export has been performed.
        </p>
        <p className="text-blue-700 mb-4">
          Annual plan renewals are refundable within <span className="font-semibold">7 days</span> only if there has been <span className="font-semibold">no usage after renewal</span>.
          Otherwise renewals are non-refundable. You can turn off auto-renew any time before the renewal date.
        </p>

        {/* Lifetime / One-time */}
        <h2 className="text-2xl font-semibold mt-10 mb-3">Lifetime (One-Time) Purchases</h2>
        <p className="text-blue-700 mb-4">
          Lifetime purchases are refundable within <span className="font-semibold">14 days</span> of purchase if usage is light:
          fewer than <span className="font-semibold">50 conversations</span> or <span className="font-semibold">1,000 assistant messages</span>, and no data export has been performed.
          After 14 days or above these usage limits, lifetime purchases are non-refundable.
        </p>

        {/* Credits / Add-ons */}
        <h2 className="text-2xl font-semibold mt-10 mb-3">Add-ons & Credits</h2>
        <p className="text-blue-700 mb-4">
          One-time add-ons or credit packs are refundable only if completely unused. Partially used add-ons are non-refundable.
        </p>

        {/* Service issues */}
        <h2 className="text-2xl font-semibold mt-10 mb-3">Service Issues</h2>
        <p className="text-blue-700 mb-4">
          If you experience a material technical issue and we cannot resolve it within <span className="font-semibold">5 business days</span> of your
          report, we’ll provide a pro-rated refund or account credit at our discretion, regardless of the windows above.
        </p>

        {/* How to request */}
        <h2 className="text-2xl font-semibold mt-10 mb-3">How to Request a Refund</h2>
        <ul className="list-disc pl-6 text-blue-700 space-y-2 mb-4">
          <li>Send an email to <span className="font-semibold">support@in60second.net</span>.</li>
          <li>Include your account email and the <span className="font-semibold">Verifone (2Checkout) order number</span> from the payment receipt.</li>
          <li>Tell us the reason for the request and whether you prefer a refund or account credit.</li>
        </ul>
        <p className="text-blue-700 mb-4">
          Approved refunds are returned to the original payment method. Banks typically take <span className="font-semibold">5–10 business days</span>
          to post the funds back to your account. Your card statement shows <span className="font-semibold">“2CO*IN60SECOND”</span>.
        </p>

        {/* Abuse / chargebacks */}
        <h2 className="text-2xl font-semibold mt-10 mb-3">Abuse & Chargebacks</h2>
        <p className="text-blue-700 mb-4">
          We may deny refunds in cases of fraud, abuse, or violation of our Terms of Service. If you’re considering a chargeback,
          please contact us first—most issues can be resolved quickly.
        </p>

        {/* Company block */}
        <div className="mt-12 border-t border-blue-200 pt-6 text-sm text-blue-700">
          <p className="mb-1"><span className="font-semibold">Legal entity:</span> In60Second LLC</p>
          <p className="mb-1"><span className="font-semibold">Mailing address:</span> 1001 S MAIN ST, STE 600, KALISPELL, MT 59901-5635, USA</p>
          <p className="mb-1">
            <span className="font-semibold">Payments:</span> Processed securely by Verifone (2Checkout), our Merchant of Record.
            Taxes/VAT/GST are calculated at checkout. Billing descriptor: “2CO*IN60SECOND”.
          </p>
          <p className="mb-1"><span className="font-semibold">Support:</span> support@in60second.net</p>
        </div>
      </div>
    </div>
  )
}
