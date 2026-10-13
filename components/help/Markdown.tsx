import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from '@/i18n/navigation'

interface MarkdownProps {
  content: string
  className?: string
}

/**
 * Renders markdown content with GFM (tables, strikethrough, etc.)
 * and converts internal links to locale-aware Next.js Links.
 */
export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            // Internal links start with / and use Next.js Link
            if (href?.startsWith('/')) {
              return <Link href={href}>{children}</Link>
            }
            // External links open in new tab
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
