"use client"

import { useLayoutEffect } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const SELECTORS = [
  "[data-home-parallax=hero]",
  "[data-home-parallax=value]",
  "[data-home-parallax=facilities]",
  "[data-home-parallax=rooms]",
  "[data-home-parallax=booking]",
  "[data-home-parallax=pricing]",
  "[data-home-parallax=member]",
  "[data-home-parallax=faq]",
  "[data-home-parallax=directions]",
  "[data-home-parallax=footer]",
] as const

gsap.registerPlugin(ScrollTrigger)

export default function HomepageParallax() {
  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) return

    const context = gsap.context(() => {
      const mobile = window.matchMedia("(max-width: 767px)").matches
      const amount = mobile ? 0.5 : 1
      SELECTORS.forEach((selector, index) => {
        const section = document.querySelector<HTMLElement>(selector)
        if (!section) return
        const marked = Array.from(section.querySelectorAll<HTMLElement>("[data-parallax-layer]"))
        if (marked.length === 0) return
        marked.forEach((target, layerIndex) => {
          const depth = layerIndex === 0 ? -12 : 7
          gsap.fromTo(target, { yPercent: 0 }, {
            yPercent: depth * amount,
            ease: "none",
            scrollTrigger: {
              id: `homepage-parallax-${index}-${layerIndex}`,
              trigger: section,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          })
        })
      })
    })

    return () => context.revert()
  }, [])

  return null
}
