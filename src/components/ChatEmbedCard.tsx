import React from 'react';

type Props = {
  src: string;                 // iframe URL (e.g., booking page)
  title?: string;
};

export default function ChatEmbedCard({ src, title = 'Embedded content' }: Props) {
  return (
    <div className="chat-embed">
      <div className="chat-embed__wrap">
        <iframe
          className="chat-embed__frame"
          src={src}
          title={title}
          allow="fullscreen; clipboard-read; clipboard-write; geolocation; microphone; camera"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
        />
      </div>
    </div>
  );
}
