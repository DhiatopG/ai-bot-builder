// src/app/embed/bot/layout.tsx
import type { ReactNode } from "react";

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Override the root layout's bg-white for this route only */}
      <style
        // no <html>/<body> here; just override styles
        dangerouslySetInnerHTML={{
          __html: `
:root, html, body, #__next, #root { background: transparent !important; }
#in60-backdrop, .in60-backdrop { background: transparent !important; pointer-events: none !important; }
#in60-backdrop.is-open, .in60-backdrop.is-open { background: rgba(0,0,0,.35) !important; pointer-events: auto !important; }
          `,
        }}
      />
      {/* Route wrapper stays transparent; children render your BotWidget/page */}
      <div className="bg-transparent">{children}</div>
    </>
  );
}
