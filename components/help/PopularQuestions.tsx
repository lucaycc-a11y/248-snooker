"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface PopularQuestionsProps {
  locale?: string;
}

const POPULAR_ARTICLE_SLUGS = [
  "entry-qr",
  "booking",
  "find-qr",
  "cancellation-policy",
  "contact-support",
] as const;

export function PopularQuestions({ locale = "zh-HK" }: PopularQuestionsProps) {
  const t = useTranslations("help");

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
      <h2 className="mb-8 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
        {t("popularQuestions")}
      </h2>

      <div className="space-y-0 divide-y divide-neutral-200">
        {POPULAR_ARTICLE_SLUGS.map((slug, index) => (
          <motion.div
            key={slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: index * 0.06,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            <Link
              href={`/${locale}/support/${slug}`}
              className="group flex items-center justify-between py-5 transition-colors hover:bg-neutral-50"
            >
              <div className="flex-1">
                <h3 className="text-base font-medium text-neutral-900 transition-colors group-hover:text-neutral-700 sm:text-lg">
                  {t(`articles.${slug}.title`)}
                </h3>
                <p className="mt-1 text-sm text-neutral-600 sm:text-base">
                  {t(`articles.${slug}.excerpt`)}
                </p>
              </div>
              <ChevronRight className="ml-4 h-5 w-5 flex-shrink-0 text-neutral-400 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
