import { plainText } from '@/lib/blog/seoCheck'

const BASE = 'https://space8.com.hk'

export type FaqItem = { question: string; answer: string }

/** FAQ pairs from `<details><summary>Q</summary>A</details>` blocks (the format the importer produces). */
export function extractFaq(html: string | null): FaqItem[] {
  if (!html) return []
  const out: FaqItem[] = []
  const re = /<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const question = plainText(m[1]).trim()
    const answer = plainText(m[2]).trim()
    if (question && answer) out.push({ question, answer })
  }
  return out.slice(0, 20)
}

export function wordCount(html: string | null): number {
  if (!html) return 0
  const text = plainText(html)
  const cjk = (text.match(/[㐀-鿿]/g) ?? []).length
  const latin = text.replace(/[㐀-鿿]/g, ' ').split(/\s+/).filter(Boolean).length
  return cjk + latin
}

type PostLike = {
  title: string
  content: string | null
  excerpt: string | null
  seo_description: string | null
  cover_image_url: string | null
  og_image_url: string | null
  category: string | null
  author: string | null
  published_at: string | null
  updated_at?: string | null
}

/** BlogPosting + BreadcrumbList (+ FAQPage when the article has Q&A blocks) as one @graph. */
export function buildBlogGraph(post: PostLike, locale: string, url: string, blogUrl: string) {
  const cover = post.cover_image_url || post.og_image_url
  const faq = extractFaq(post.content)
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      headline: post.title,
      description: post.seo_description || post.excerpt || undefined,
      image: cover ? [cover] : undefined,
      datePublished: post.published_at || undefined,
      dateModified: post.updated_at || post.published_at || undefined,
      inLanguage: locale,
      wordCount: wordCount(post.content) || undefined,
      articleSection: post.category || undefined,
      author: { '@type': 'Organization', name: post.author || 'Space8', url: BASE },
      publisher: { '@type': 'Organization', name: 'Space8', url: BASE, logo: { '@type': 'ImageObject', url: `${BASE}/favicon/web-app-manifest-512x512.png` } },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      isPartOf: { '@type': 'Blog', url: blogUrl, name: 'Space8 Blog' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Space8', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: blogUrl },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    },
  ]
  if (faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    })
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}
