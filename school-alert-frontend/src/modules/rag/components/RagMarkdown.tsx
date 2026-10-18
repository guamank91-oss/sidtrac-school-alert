import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface RagMarkdownProps {
  content: string
}

/**
 * El modelo (o el modo fallback) a veces devuelve sub-viñetas con el caracter "•"
 * juntas en una sola línea. Las convertimos en una lista Markdown real, con cada
 * viñeta en su propia línea e indentada bajo el punto que la contiene.
 */
function normalizeBullets(raw: string): string {
  if (!raw.includes('•')) return raw
  const out: string[] = []
  for (const line of raw.split('\n')) {
    if (!line.includes('•')) {
      out.push(line)
      continue
    }
    const segments = line.split('•')
    const head = segments[0].replace(/\s+$/, '')
    const bullets = segments
      .slice(1)
      .map((s) => s.trim())
      .filter(Boolean)

    const orderedMatch = head.match(/^(\s*)\d+\.\s/)
    const unorderedMatch = head.match(/^(\s*)[-*]\s/)
    const indent = orderedMatch
      ? `${orderedMatch[1]}   `
      : unorderedMatch
        ? `${unorderedMatch[1]}  `
        : ''

    if (head.trim()) out.push(head)
    for (const b of bullets) out.push(`${indent}- ${b}`)
  }
  return out.join('\n')
}

function RagMarkdownComponent({ content }: RagMarkdownProps) {
  const normalized = normalizeBullets(content)
  return (
    <div className="rag-markdown text-sm leading-relaxed text-slate-200 [word-break:break-word] font-normal">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-slate-200">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
          h1: ({ children }) => (
            <h1 className="mb-3 mt-4 text-lg font-bold text-white first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 text-base font-bold text-white first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-3 text-sm font-semibold text-white first:mt-0">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0 marker:text-purple-400 [li>&]:mt-1.5 [li>&]:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0 marker:font-semibold marker:text-purple-400 [li>&]:mt-1.5 [li>&]:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-purple-400 underline underline-offset-2 hover:text-purple-300 transition-colors"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-purple-500/50 bg-purple-500/10 px-4 py-2 text-slate-300 italic rounded-r-lg">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-white/10" />,
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className ?? '')
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-slate-300 shadow-inner border border-white/5">
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[0.8em] text-purple-200 border border-white/5">
                {children}
              </code>
            )
          },
          pre: ({ children }) => <pre className="my-3">{children}</pre>,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-white/10 shadow-lg bg-black/20">
              <table className="w-full border-collapse text-xs text-slate-300">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-black/40 border-b border-white/10">{children}</thead>,
          th: ({ children }) => (
            <th className="px-4 py-2.5 text-left font-semibold text-white">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-white/5 px-4 py-2 align-top">{children}</td>
          ),
          tr: ({ children }) => <tr className="hover:bg-white/5 transition-colors">{children}</tr>,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  )
}

export const RagMarkdown = memo(RagMarkdownComponent)
