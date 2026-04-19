/**
 * renderInline — pequeno parser de markdown-inline para mensagens do chat.
 *
 * Suporta:
 *   **negrito**   → <strong>
 *   *itálico*     → <em>      (não confunde com **: regex de bold roda primeiro)
 *   `código`      → <code>
 *
 * Uso: `<p className="whitespace-pre-wrap">{renderInline(msg.text)}</p>`.
 *
 * Propositalmente minimalista — não suporta listas/headings/links porque o
 * ai-worker retorna prosa corrida. Se precisar de mais, migrar pra
 * `react-markdown`.
 */
import type { ReactNode } from 'react';

type Token = { type: 'text' | 'bold' | 'italic' | 'code'; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  // Ordem importa: bold (**) antes de italic (*).
  const re = /\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|`([^`\n]+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: input.slice(last, m.index) });
    if (m[1] != null) tokens.push({ type: 'bold', value: m[1] });
    else if (m[2] != null) tokens.push({ type: 'italic', value: m[2] });
    else if (m[3] != null) tokens.push({ type: 'code', value: m[3] });
    last = re.lastIndex;
  }
  if (last < input.length) tokens.push({ type: 'text', value: input.slice(last) });
  return tokens;
}

export function renderInline(text: string): ReactNode {
  if (!text) return null;
  return tokenize(text).map((t, i) => {
    switch (t.type) {
      case 'bold':
        return <strong key={i}>{t.value}</strong>;
      case 'italic':
        return <em key={i}>{t.value}</em>;
      case 'code':
        return (
          <code
            key={i}
            className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.5 text-[0.9em]"
          >
            {t.value}
          </code>
        );
      default:
        return <span key={i}>{t.value}</span>;
    }
  });
}
