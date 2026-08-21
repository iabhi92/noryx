import { useState } from 'react';
import { highlightCode } from '../lib/highlight';

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const tokens = highlightCode(code);

  function handleCopy() {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative bg-black/60 border border-outline-variant/20 rounded-lg overflow-hidden my-2">
      <div className="holo-bracket tl" />
      <div className="holo-bracket tr" />
      <div className="holo-bracket bl" />
      <div className="holo-bracket br" />
      <div className="scanlines rounded-lg opacity-40" />
      <div className="relative z-20 flex items-center justify-between px-3 py-1.5 border-b border-white/5">
        <span className="font-code-md text-[10px] uppercase tracking-widest text-electric-blue/70">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="font-code-md text-[10px] uppercase tracking-wide text-on-surface-variant hover:text-electric-blue transition-colors"
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <pre className="relative z-20 overflow-x-auto p-3">
        <code className="font-code-md text-xs leading-relaxed text-on-surface/90 whitespace-pre">
          {tokens.map((t, i) =>
            t.className ? (
              <span key={i} className={t.className}>
                {t.text}
              </span>
            ) : (
              t.text
            ),
          )}
        </code>
      </pre>
    </div>
  );
}
