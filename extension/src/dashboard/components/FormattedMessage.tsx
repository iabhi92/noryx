import { CodeBlock } from './CodeBlock';

interface FormattedMessageProps {
  text: string;
}

const FENCE_RE = /```(\S*)\n?([\s\S]*?)```/g;

/** Splits a hint/chat message on markdown code fences and renders each piece appropriately —
 *  prose stays plain text, fenced code gets a real code block (see CodeBlock.tsx). Plain messages
 *  with no fences render exactly as before (a single paragraph), so this is a drop-in replacement
 *  everywhere a hint/turn's raw text was rendered as one <p>. */
export default function FormattedMessage({ text }: FormattedMessageProps) {
  const segments: Array<{ type: 'text' | 'code'; content: string; language: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(FENCE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ type: 'text', content: text.slice(lastIndex, index), language: '' });
    segments.push({ type: 'code', content: match[2].replace(/\n$/, ''), language: match[1] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ type: 'text', content: text.slice(lastIndex), language: '' });

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'code' ? (
          <CodeBlock key={i} language={seg.language} code={seg.content} />
        ) : seg.content.trim() ? (
          <p key={i} className="text-on-surface/90 leading-relaxed whitespace-pre-wrap">
            {seg.content}
          </p>
        ) : null,
      )}
    </>
  );
}
