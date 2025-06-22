'use client';

export default function HomePage() {
  return (
    <main className="bg-white text-gray-900 px-6 py-12 sm:py-20">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">
          Turn Your Website into a <br /> 24/7 Lead-Closing Machine
        </h1>
        <p className="text-lg sm:text-xl mb-8">
          Busy-as-hell business owners. You don’t have time to answer the same damn questions over and over.
          <br /> Now you don’t have to.
        </p>
        <a
          href="/login"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold px-6 py-3 rounded-lg transition"
        >
          🚀 Start Free Trial Now
        </a>
      </div>

      <div className="max-w-3xl mx-auto mt-16 grid gap-10 text-left">
        <Feature title="🤖 AI Assistant for Your Website" description="Answers FAQs in real time — from your site, your files, or your custom Q&A. No coding. No stress. Feels human. Works like magic." />
        <Feature title="🧠 Custom Knowledge Base" description="Drop your site links, upload PDFs/TXT, write custom answers — your assistant blends it all." />
        <Feature title="🧪 7-Day Free Trial" description="Full access. No credit card. Just results." />
        <Feature title="📥 Built-In Lead Collection" description="Assistant asks for name & email naturally inside chat. Auto-saved to your CRM (Airtable, NocoDB...)" />
        <Feature title="💬 Real-Time Chat Interface" description="Smooth, mobile-friendly, feels alive. Supports buttons & logic." />
        <Feature title="📊 Conversation & Lead Logs" description="Track every interaction. View or export in your dashboard." />
        <Feature title="📆 AI-Powered Daily Summaries" description="Know what your users ask — every morning. Straight to your dashboard." />
        <Feature title="🛠️ Drag & Drop Dashboard" description="Build assistants, upload files, customize Q&A — no tech skills needed." />
        <Feature title="🏁 Launch It and Let It Work" description="Let your assistant sell, serve, and scale while you sleep." />
      </div>

      <div className="text-center mt-20 text-sm text-gray-500">
        <p>Trusted by Professionals Worldwide</p>
        <p className="mt-2">&copy; 2025 In60second</p>
        <div className="flex justify-center gap-4 mt-2">
          <a href="/privacy" className="underline">Privacy Policy</a>
          <a href="/terms" className="underline">Terms of Service</a>
        </div>
      </div>
    </main>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-xl font-semibold mb-1">{title}</h3>
      <p className="text-gray-700">{description}</p>
    </div>
  );
}
