"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { ContainerScroll } from "@/components/ui/container-scroll-animation"

export default function SpacePilotScrollDemo() {
  const t = useTranslations("spacePilot")

  return (
    <section
      data-nav-theme="dark"
      className="overflow-hidden bg-black px-4 pb-16 pt-8 md:px-8 md:pb-24 md:pt-12"
      aria-labelledby="space-pilot-scroll-title"
    >
      <ContainerScroll
        titleComponent={
          <>
            <h2
              id="space-pilot-scroll-title"
              data-cms-key="spacePilot.title"
              className="text-3xl font-semibold tracking-tight text-white md:text-5xl"
            >
              {t("title")}
            </h2>
            <p
              data-cms-key="spacePilot.intro"
              className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg"
            >
              {t("intro")}
            </p>
          </>
        }
      >
        <Image
          src="/gallery/table-poster.jpg"
          alt={t("title")}
          width={1400}
          height={720}
          sizes="(max-width: 768px) 100vw, 960px"
          className="h-full w-full object-cover object-center"
          draggable={false}
        />
      </ContainerScroll>
    </section>
  )
}
