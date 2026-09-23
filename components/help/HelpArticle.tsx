import type { HelpArticleSlug } from '@/content/help/types'
import { getHelpArticleContent } from '@/content/help/loader'
import { Callout } from './Callout'

interface HelpArticleProps {
  slug: HelpArticleSlug
  locale?: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
}

export function HelpArticle({ slug, locale = 'zh-HK' }: HelpArticleProps) {
  const content = getHelpArticleContent(slug, locale)

  return (
    <article className="prose prose-slate max-w-none">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">
        {content.title}
      </h1>

      {content.intro && (
        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
          {content.intro}
        </p>
      )}

      <div className="space-y-8">
        {content.sections.map((section, sectionIndex) => (
          <section key={sectionIndex} className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">
              {section.title}
            </h2>

            <div className="text-slate-700 leading-relaxed space-y-4">
              {section.content.map((item, itemIndex) => {
                if (typeof item === 'string') {
                  // Handle different markdown-like patterns
                  if (item.startsWith('**') && item.includes('**')) {
                    // Bold text (questions/headers within content)
                    return (
                      <p key={itemIndex} className="font-semibold">
                        {item.replace(/\*\*/g, '')}
                      </p>
                    )
                  } else if (item.startsWith('• ')) {
                    // Bullet point
                    return (
                      <li key={itemIndex} className="ml-4">
                        {item.substring(2)}
                      </li>
                    )
                  } else if (item.match(/^\d+\. /)) {
                    // Numbered list item
                    return (
                      <li key={itemIndex} className="ml-4 list-decimal">
                        {item.replace(/^\d+\. /, '')}
                      </li>
                    )
                  } else if (item === '') {
                    // Empty line for spacing
                    return <div key={itemIndex} className="h-2" />
                  } else {
                    // Regular paragraph
                    return <p key={itemIndex}>{item}</p>
                  }
                } else if (item.type === 'callout') {
                  // Callout component
                  return (
                    <Callout key={itemIndex} variant={item.variant}>
                      {item.text}
                    </Callout>
                  )
                }
                return null
              })}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}
