import { notFound } from "next/navigation";
import { HelpArticle } from "@/components/help/HelpArticle";
import { helpArticles } from "@/content/help/registry";
import type { HelpArticleSlug } from "@/content/help/types";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function generateStaticParams() {
  return helpArticles.map((article) => ({
    slug: article.slug,
  }));
}

export default async function SupportArticlePage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const article = helpArticles.find((a) => a.slug === params.slug);

  if (!article) {
    notFound();
  }

  const t = await getTranslations('supportPage');

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <Link
          href={`/${params.locale}/support`}
          className="mb-8 inline-flex items-center text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t('back_to_support')}
        </Link>

        <HelpArticle
          slug={params.slug as HelpArticleSlug}
          locale={params.locale as "zh-HK" | "zh-CN" | "en"}
        />
      </div>
    </div>
  );
}
