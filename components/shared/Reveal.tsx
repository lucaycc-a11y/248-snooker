"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

// Scroll-in reveal used across the homepage: fade + rise (+ slight scale) once, when ~10% inside the viewport.
// Opacity/transform only, so it stays on the compositor. Renders children unchanged for reduced-motion users.
const EASE = [0.16, 1, 0.3, 1] as const;

export function Reveal({
  children,
  delay = 0,
  y = 40,
  scale = 0.97,
  className,
  style,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  scale?: number;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "li";
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    const Plain = as;
    return (
      <Plain className={className} style={style}>
        {children}
      </Plain>
    );
  }
  const Tag = as === "li" ? motion.li : motion.div;
  return (
    <Tag
      className={className}
      style={style}
      initial={{ opacity: 0, y, scale }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}
