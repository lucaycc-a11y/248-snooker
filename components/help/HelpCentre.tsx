"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { HelpHero } from "./HelpHero";
import { HelpTopics } from "./HelpTopics";
import { PopularQuestions } from "./PopularQuestions";
import { helpArticles } from "@/content/help/registry";
import { getHelpArticleContent } from "@/content/help/loader";
import Link from "next/link";
import { motion } from "framer-motion";

interface HelpCentreProps {
  locale?: "zh-HK" | "zh-CN" | "en" | "ja";
}

export function HelpCentre({ locale = "zh-HK" }: HelpCentreProps) {
  const t = useTranslations("help");
  const [searchQuery, setSearchQuery] = useState("");

  // Search across all articles
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    const results = helpArticles
      .map((article) => {
        const content = getHelpArticleContent(article.slug, locale);
        const titleMatch = t(article.titleKey).toLowerCase().includes(query);
        const excerptMatch = t(article.excerptKey).toLowerCase().includes(query);

        // Search in article body
        const bodyText = content.sections
          .flatMap((section) => [
            section.title,
            ...section.content.map((item) =>
              typeof item === "string" ? item : item.text
            ),
          ])
          .join(" ")
          .toLowerCase();
        const bodyMatch = bodyText.includes(query);

        if (titleMatch || excerptMatch || bodyMatch) {
          return {
            ...article,
            relevance: titleMatch ? 3 : excerptMatch ? 2 : 1,
          };
        }
        return null;
      })
      .filter((result): result is NonNullable<typeof result> => result !== null)
      .sort((a, b) => b.relevance - a.relevance);

    return results;
  }, [searchQuery, locale, t]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <div className="min-h-screen bg-white">
      <HelpHero onSearch={handleSearch} searchQuery={searchQuery} />

      {searchResults !== null ? (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
          {searchResults.length > 0 ? (
            <>
              <h2 className="mb-8 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                {searchResults.length} {t("categories.articlesCount")}
              </h2>
              <div className="space-y-0 divide-y divide-neutral-200">
                {searchResults.map((article, index) => (
                  <motion.div
                    key={article.slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.05,
                      ease: [0.25, 0.1, 0.25, 1],
                    }}
                  >
                    <Link
                      href={`/${locale}/support/${article.slug}`}
                      className="block py-5 transition-colors hover:bg-neutral-50"
                    >
                      <h3 className="mb-2 text-base font-medium text-neutral-900 sm:text-lg">
                        {t(article.titleKey)}
                      </h3>
                      <p className="text-sm text-neutral-600 sm:text-base">
                        {t(article.excerptKey)}
                      </p>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-16 text-center">
              <p className="text-lg text-neutral-600">{t("noResults")}</p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 text-base font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-700"
              >
                {t("backToSupport")}
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          <HelpTopics locale={locale} />
          <PopularQuestions locale={locale} />
        </>
      )}
    </div>
  );
}
