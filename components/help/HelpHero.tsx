"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

const SPACE8_GRADIENT =
  "linear-gradient(100deg, #3D1A08 5%, #6B3015 10%, #8B4513 18%, #A0522D 26%, #C87941 34%, #DEB887 42%, #F5DEB3 50%, #E8F5E0 56%, #A8D5A2 62%, #6BBF6B 68%, #3D8B3D 76%, #1F5C1F 84%, #0D3D0D 92%, #071F07 100%)";

interface HelpHeroProps {
  onSearch: (query: string) => void;
  searchQuery: string;
}

export function HelpHero({ onSearch, searchQuery }: HelpHeroProps) {
  const t = useTranslations("help");
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localQuery);
  };

  return (
    <div className="relative">
      {/* Hero band with gradient */}
      <div
        className="relative w-full px-4 pb-20 pt-12 sm:pb-24 sm:pt-16 md:pb-28 md:pt-20"
        style={{ background: SPACE8_GRADIENT }}
      >
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="text-base text-white/90 sm:text-lg md:text-xl">
            {t("hero.subtitle")}
          </p>
        </div>
      </div>

      {/* Search card overlapping the gradient band */}
      <div className="relative -mt-12 px-4 sm:-mt-16">
        <div className="mx-auto max-w-3xl">
          <form onSubmit={handleSubmit}>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={localQuery}
                  onChange={(e) => setLocalQuery(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-12 pr-4 text-base transition-colors placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-200"
                  aria-label={t("searchPlaceholder")}
                />
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
