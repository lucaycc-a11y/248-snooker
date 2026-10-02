"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MembershipCardProps {
  badge?: string;
  badgeDim?: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  popupContent: string;
  featured?: boolean;
}

function MembershipCard({
  badge,
  badgeDim,
  icon,
  title,
  subtitle,
  popupContent,
  featured,
}: MembershipCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("ui");

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`relative flex flex-col items-start gap-4 p-8 rounded-3xl border transition-all duration-300 hover:scale-[1.02] ${
          featured
            ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-lg"
            : "bg-white border-gray-200 hover:border-gray-300"
        }`}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
      >
        {badge && (
          <span
            className={`absolute top-4 right-4 px-3 py-1 text-xs font-semibold rounded-full ${
              badgeDim
                ? "bg-gray-100 text-gray-500"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {badge}
          </span>
        )}

        <div className="text-gray-700">{icon}</div>

        <div className="flex flex-col items-start gap-2 text-left">
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{subtitle}</p>
        </div>

        <div className="mt-auto flex items-center gap-2 text-sm font-medium text-gray-400">
          <span>{t("learnMore")}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="w-4 h-4"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative max-w-lg w-full bg-white rounded-3xl p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={t("close")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="w-6 h-6"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

              <div className="flex flex-col gap-6">
                <div className="text-gray-700">{icon}</div>
                <h3 className="text-3xl font-bold text-gray-900">{title}</h3>
                <p className="text-base text-gray-700 leading-relaxed">
                  {popupContent}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function MembershipNew() {
  const t = useTranslations("membership");

  const cards: MembershipCardProps[] = [
    {
      badge: t("cards.0.badge"),
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-12 h-12"
        >
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
          <path d="M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
        </svg>
      ),
      title: t("cards.0.title"),
      subtitle: t("cards.0.subtitle"),
      popupContent: t("cards.0.popup"),
      featured: true,
    },
    {
      badge: t("cards.1.badge"),
      badgeDim: true,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-12 h-12"
        >
          <rect x="3.5" y="9" width="17" height="11" rx="2" />
          <path d="M12 9v11M3.5 13.5h17" />
          <path d="M12 9c-2.6 0-4.2-1-4.2-2.6S9 4 10.4 4C12 4 12 6.2 12 9zM12 9c2.6 0 4.2-1 4.2-2.6S15 4 13.6 4C12 4 12 6.2 12 9z" />
        </svg>
      ),
      title: t("cards.1.title"),
      subtitle: t("cards.1.subtitle"),
      popupContent: t("cards.1.popup"),
    },
    {
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-12 h-12"
        >
          <path d="M8 21h8M12 17v4M7 3.5h10v5.5a5 5 0 01-10 0z" />
          <path d="M7 5.5H4.5a2.5 2.5 0 002.6 3.9M17 5.5h2.5a2.5 2.5 0 01-2.6 3.9" />
        </svg>
      ),
      title: t("cards.2.title"),
      subtitle: t("cards.2.subtitle"),
      popupContent: t("cards.2.popup"),
    },
  ];

  return (
    <section className="relative py-24 px-6 bg-gradient-to-b from-white via-gray-50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-16 text-center">
          <h2 className="text-5xl font-black text-gray-900 tracking-tight">
            {t("heading")}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {cards.map((card, i) => (
            <MembershipCard key={i} {...card} />
          ))}
        </div>

        <div className="max-w-3xl mx-auto space-y-12">
          <h3 className="text-2xl font-bold text-gray-900 text-center">
            {t("howToUse")}
          </h3>

          <ol className="space-y-8">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-6">
                <span className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-gray-900 text-white text-xl font-bold">
                  {i + 1}
                </span>
                <div className="flex-1 pt-2">
                  <h4 className="text-lg font-bold text-gray-900 mb-2">
                    {t(`steps.${i}.title`)}
                    {i === 1 && (
                      <span className="ml-3 px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">
                        {t("steps.1.badge")}
                      </span>
                    )}
                  </h4>
                  <p className="text-base text-gray-600 leading-relaxed">
                    {t(`steps.${i}.description`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="text-sm text-gray-500 text-center pt-8">
            {t("footnote")}
          </p>

          <div className="flex justify-center">
            <a
              href="/membership"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gray-900 text-white text-lg font-semibold rounded-full hover:bg-gray-800 transition-colors shadow-lg hover:shadow-xl"
            >
              {t("ctaButton")}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="w-5 h-5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
