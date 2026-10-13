import fs from 'fs'
import path from 'path'
import { getConfig, replaceTokens } from './config-loader'

export interface HelpTopic {
  id: string
  title: string
  description: string
  icon: string
  href: string
  span?: number
  image?: {
    src: string
    srcset: string
    alt: string
  }
}

export interface HelpArticle {
  id: string
  title: string
  summary: string
  content: string
  published: boolean
  gate: string | null
}

export interface HelpTopicData {
  title: string
  description: string
  articles: HelpArticle[]
}

export interface HelpAnnouncement {
  id: string
  title: string
  date: string
  summary: string
  content: string
  published: boolean
}

export interface HelpContent {
  hero: {
    title: string
    subtitle: string
    searchPlaceholder: string
    image: {
      src: string
      srcset: string
      alt: string
    }
  }
  topics: HelpTopic[]
  popularQuestionsTitle: string
  popularQuestions: Array<{
    question: string
    topic: string
    article: string
  }>
  announcementsTitle: string
  announcements: HelpAnnouncement[]
  browseTopicsTitle: string
  searchResultsTitle: string
  noResultsTitle: string
  noResultsMessage: string
  topics_data: Record<string, HelpTopicData>
  tokenMap: Record<string, string>
}

let contentCache: { data: HelpContent; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Loads the help content JSON file and returns it with tokens replaced.
 * Falls back to zh-Hant if locale file not found.
 */
export async function getHelpContent(locale: string = 'zh-Hant'): Promise<HelpContent> {
  const now = Date.now()

  if (contentCache && now - contentCache.timestamp < CACHE_TTL) {
    return contentCache.data
  }

  const contentPath = path.join(process.cwd(), 'content/help', `help.${locale}.json`)
  const fallbackPath = path.join(process.cwd(), 'content/help', 'help.zh-Hant.json')

  let filePath = contentPath
  if (!fs.existsSync(contentPath)) {
    console.warn(`[help/loader] Content file not found for locale ${locale}, falling back to zh-Hant`)
    filePath = fallbackPath
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const content: HelpContent = JSON.parse(raw)

  // Load config and replace all tokens
  const config = await getConfig()
  const processedContent = replaceTokensInContent(content, config)

  contentCache = { data: processedContent, timestamp: now }
  return processedContent
}

/**
 * Recursively replaces tokens in the entire content object.
 */
function replaceTokensInContent(content: HelpContent, config: Record<string, unknown>): HelpContent {
  const { tokenMap } = content

  const replaceInString = (text: string): string => replaceTokens(text, tokenMap, config)

  const replaceInObject = <T>(obj: T): T => {
    if (typeof obj === 'string') {
      return replaceInString(obj) as unknown as T
    }
    if (Array.isArray(obj)) {
      return obj.map(replaceInObject) as unknown as T
    }
    if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = replaceInObject(value)
      }
      return result as T
    }
    return obj
  }

  return replaceInObject(content)
}

/**
 * Gets a specific topic's data.
 */
export async function getTopicData(topicId: string, locale: string = 'zh-Hant'): Promise<HelpTopicData | null> {
  const content = await getHelpContent(locale)
  return content.topics_data[topicId] || null
}

/**
 * Gets a specific article.
 */
export async function getArticle(
  topicId: string,
  articleId: string,
  locale: string = 'zh-Hant',
  gates?: Record<string, boolean>
): Promise<HelpArticle | null> {
  const topicData = await getTopicData(topicId, locale)
  if (!topicData) return null

  const article = topicData.articles.find((a) => a.id === articleId)
  if (!article) return null

  // Check visibility
  if (!article.published) return null
  if (article.gate && gates && !gates[article.gate]) return null

  return article
}

/**
 * Gets all published announcements.
 */
export async function getAnnouncements(locale: string = 'zh-Hant'): Promise<HelpAnnouncement[]> {
  const content = await getHelpContent(locale)
  return content.announcements.filter((a) => a.published)
}

/**
 * Gets a specific announcement by ID.
 */
export async function getAnnouncement(id: string, locale: string = 'zh-Hant'): Promise<HelpAnnouncement | null> {
  const announcements = await getAnnouncements(locale)
  return announcements.find((a) => a.id === id) || null
}

/**
 * Gets all topic IDs for static generation.
 */
export async function getAllTopics(): Promise<string[]> {
  const content = await getHelpContent('zh-Hant')
  return Object.keys(content.topics_data)
}

/**
 * Gets all article IDs for a topic for static generation.
 */
export async function getAllArticles(topicId: string): Promise<string[]> {
  const topicData = await getTopicData(topicId, 'zh-Hant')
  if (!topicData) return []
  return topicData.articles.filter((a) => a.published).map((a) => a.id)
}

/**
 * Gets all announcement IDs for static generation.
 */
export async function getAllAnnouncementIds(): Promise<string[]> {
  const announcements = await getAnnouncements('zh-Hant')
  return announcements.map((a) => a.id)
}

/**
 * Gets all searchable content (articles + announcements).
 */
export async function getSearchableContent(
  locale: string = 'zh-Hant',
  gates?: Record<string, boolean>
): Promise<Array<{ type: 'article' | 'announcement'; title: string; content: string; url: string }>> {
  const content = await getHelpContent(locale)
  const results: Array<{ type: 'article' | 'announcement'; title: string; content: string; url: string }> = []

  // Add articles
  for (const [topicId, topicData] of Object.entries(content.topics_data)) {
    for (const article of topicData.articles) {
      if (!article.published) continue
      if (article.gate && gates && !gates[article.gate]) continue

      results.push({
        type: 'article',
        title: article.title,
        content: `${article.summary} ${article.content}`,
        url: `/help/${topicId}/${article.id}`,
      })
    }
  }

  // Add announcements
  for (const announcement of content.announcements) {
    if (!announcement.published) continue

    results.push({
      type: 'announcement',
      title: announcement.title,
      content: `${announcement.summary} ${announcement.content}`,
      url: `/help/announcements/${announcement.id}`,
    })
  }

  return results
}
