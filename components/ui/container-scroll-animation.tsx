"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion"
import type { MotionValue } from "framer-motion"

type ContainerScrollProps = {
  titleComponent: React.ReactNode
  children: React.ReactNode
}

type HeaderProps = {
  translate: MotionValue<number>
  titleComponent: React.ReactNode
}

type CardProps = {
  rotate: MotionValue<number>
  scale: MotionValue<number>
  translate: MotionValue<number>
  children: React.ReactNode
}

export const ContainerScroll = ({
  titleComponent,
  children,
}: ContainerScrollProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const scaleDimensions = isMobile ? [0.7, 0.9] : [1.05, 1]
  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0])
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions)
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100])

  return (
    <div
      className="relative flex h-[48rem] items-center justify-center p-2 md:h-[64rem] md:p-20"
      ref={containerRef}
    >
      <div
        className="relative w-full py-10 md:py-32"
        style={{ perspective: "1000px" }}
      >
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  )
}

export const Header = ({ translate, titleComponent }: HeaderProps) => {
  return (
    <motion.div
      style={{ translateY: translate }}
      className="mx-auto max-w-5xl text-center"
    >
      {titleComponent}
    </motion.div>
  )
}

export const Card = ({ rotate, scale, children }: CardProps) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="mx-auto -mt-12 h-[23rem] w-full max-w-5xl rounded-[30px] border-4 border-[#6C6C6C] bg-[#222222] p-2 md:h-[36rem] md:p-6"
    >
      <div className="h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 md:p-4">
        {children}
      </div>
    </motion.div>
  )
}
