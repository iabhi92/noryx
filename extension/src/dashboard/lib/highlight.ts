// Lives under dashboard/lib, not the shared lib/, because it returns real Tailwind class names —
// Tailwind's content scan only covers src/dashboard/**, same reason CircularTimer.tsx (genuinely
// shared with the non-Tailwind overlay bundle) avoids Tailwind classes entirely. A first pass of
// this file lived in lib/ and shipped with .text-neon-pink/.text-neon-cyan silently missing from
// the compiled CSS — caught by actually rendering a code block, not by reading the diff.

export interface HighlightToken {
  text: string;
  className?: string;
}

// Single-pass tokenizer, not per-pattern global replaces — a keyword sitting inside a string
// (or a `#` inside a string) would otherwise get double-colored by independent passes. Language-
// agnostic on purpose: chat code blocks span whatever the user's judge language happens to be
// (JS/Python/Java/C++/...), so this covers common keywords across all of them rather than
// building a per-language grammar.
const TOKEN_RE = new RegExp(
  [
    '(//[^\\n]*|#[^\\n]*|/\\*[\\s\\S]*?\\*/)', // 1: comment
    '("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)', // 2: string
    '(\\b(?:function|const|let|var|if|else|elif|for|while|do|return|def|class|public|private|' +
      'protected|static|void|int|long|double|float|string|String|bool|boolean|char|import|from|' +
      'export|default|new|this|self|true|false|True|False|null|None|nil|undefined|async|await|' +
      'try|catch|except|finally|switch|case|break|continue|throw|extends|implements|interface|' +
      'enum|namespace|struct|typedef|template|using|include|package|in|of|is|not|and|or|lambda|' +
      'yield|with|as|pass|match)\\b)', // 3: keyword
    '([A-Za-z_$][\\w$]*)(?=\\s*\\()', // 4: identifier immediately followed by ( — a call/def name
  ].join('|'),
  'g',
);

export function highlightCode(code: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let lastIndex = 0;

  for (const match of code.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) tokens.push({ text: code.slice(lastIndex, index) });

    const [, comment, string, keyword, identifier] = match;
    if (comment) tokens.push({ text: comment, className: 'text-on-surface-variant/60 italic' });
    else if (string) tokens.push({ text: string, className: 'text-neon-green/90' });
    else if (keyword) tokens.push({ text: keyword, className: 'text-neon-pink' });
    else if (identifier) tokens.push({ text: identifier, className: 'text-neon-cyan' });

    lastIndex = index + match[0].length;
  }
  if (lastIndex < code.length) tokens.push({ text: code.slice(lastIndex) });

  return tokens;
}
