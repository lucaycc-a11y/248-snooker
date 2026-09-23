"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { helpArticles } from "@/content/help/registry";
import type { LucideIcon } from "lucide-react";

interface HelpTopicsProps {
  locale?: string;
}

const SPACE8_PRIMARY = "#C87941";
const SPACE8_ACCENT = "#6BBF6B";

export function HelpTopics({ locale = "zh-HK" }: HelpTopicsProps) {
  const t = useTranslations("help");

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
      <h2 className="mb-8 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
        {t("browseTopics")}
      </h2>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {helpArticles.map((article, index) => {
          const IconComponent = (Icons[
            article.icon as keyof typeof Icons
          ] || Icons.HelpCircle) as LucideIcon;

          return (
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
                className="group block h-full"
              >
                <div className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-6 transition-all hover:border-neutral-300 hover:bg-neutral-50">
                  <div
                    className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-colors"
                    style={{
                      backgroundColor: `${index % 2 === 0 ? SPACE8_PRIMARY : SPACE8_ACCENT}15`,
                    }}
                  >
                    <IconComponent
                      className="h-6 w-6"
                      style={{
                        color: index % 2 === 0 ? SPACE8_PRIMARY : SPACE8_ACCENT,
                      }}
                    />
                  </div>

                  <h3 className="mb-2 text-base font-semibold text-neutral-900 sm:text-lg">
                    {t(article.titleKey)}
                  </h3>

                  <p className="text-sm text-neutral-600 sm:text-base">
                    {t(article.excerptKey)}
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
