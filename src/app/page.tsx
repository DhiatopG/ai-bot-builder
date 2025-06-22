'use client';

import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen px-6 py-16 sm:py-24 flex flex-col items-center bg-white text-gray-800">
      <div className="max-w-4xl w-full text-center space-y-8">
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight text-gray-900">
          Turn Your Website into a <br /> 24/7 Lead-Closing Machine
        </h1>
        <p className="text-lg sm:text-xl text-gray-700">
          Busy-as-hell business owners.<br />
          You don’t have time to answer the same damn questions over and over. Now you don’t have to.
        </p>
        <a
          href="#"
          className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition"
        >
          Start Free Trial Now
        </a>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left mt-12">
          <Feature
            title="🤖 AI Assistant for Your Website"
            desc="Answers FAQs in real time — from your site, your files, or your custom Q&A. No coding. No stress. Feels human. Works like magic."
          />
          <Feature
            title="🧠 Custom Knowledge Base"
            desc="Drop your site links, upload PDFs/TXT, write custom answers — your assistant blends it all."
          />
          <Feature
            title="🧪 7-Day Free Trial"
            desc="Full access. No credit card. Just results."
          />
          <Feature
            title="📥 Built-In Lead Collection"
            desc="Assistant asks for name & email naturally inside chat. Auto-saved to your CRM (Airtable, NocoDB...)"
          />
          <Feature
            title="💬 Real-Time Chat Interface"
            desc="Smooth, mobile-friendly, feels alive. Supports buttons & logic."
          />
          <Feature
            title="📊 Conversation & Lead Logs"
            desc="Track every interaction. View or export in your dashboard."
          />
          <Feature
            title="📆 AI-Powered Daily Summaries"
            desc="Know what your users ask — every morning. Straight to your dashboard."
          />
          <Feature
            title="🛠️ Drag & Drop Dashboard"
            desc="Build assistants, upload files, customize Q&A — no tech skills needed."
          />
        </div>

        <h2 className="text-2xl font-semibold mt-12">
          🏁 Launch It and Let It Work
        </h2>
        <p className="text-gray-600">
          Let your assistant sell, serve, and scale while you sleep.
        </p>
        <p className="text-sm mt-2 text-gray-500">Trusted by Professionals Worldwide</p>

        <a
          href="#"
          className="mt-6 inline-block px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition"
        >
          Launch Your Assistant Now — Free Trial
        </a>
      </div>

      <footer className="mt-16 text-center text-gray-400 text-sm">
        <p>© 2025 In60second</p>
        <p className="mt-1">
          <a href="/privacy" className="underline">Privacy Policy</a> |{" "}
          <a href="/terms" className="underline">Terms of Service</a>
        </p>
      </footer>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg shadow-sm">
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{desc}</p>
    </div>
  );
}
