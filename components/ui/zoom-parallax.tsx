"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface ZoomParallaxImage {
  src: string;
  alt: string;
}

interface ZoomParallaxProps {
  images: ZoomParallaxImage[];
}

export function ZoomParallax({ images }: ZoomParallaxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const scales = [4, 5, 6, 5, 6.5, 6, 7];

  const scale0 = useTransform(scrollYProgress, [0, 1], [1, scales[0]]);
  const scale1 = useTransform(scrollYProgress, [0, 1], [1, scales[1]]);
  const scale2 = useTransform(scrollYProgress, [0, 1], [1, scales[2]]);
  const scale3 = useTransform(scrollYProgress, [0, 1], [1, scales[3]]);
  const scale4 = useTransform(scrollYProgress, [0, 1], [1, scales[4]]);
  const scale5 = useTransform(scrollYProgress, [0, 1], [1, scales[5]]);
  const scale6 = useTransform(scrollYProgress, [0, 1], [1, scales[6]]);
  const scaleTransforms = [scale0, scale1, scale2, scale3, scale4, scale5, scale6];

  return (
    <div
      ref={containerRef}
      style={{ height: "300vh" }}
      className="relative w-full"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
        <div className="absolute inset-0">
          {images.map((image, i) => {
            const positions = [
              { top: "0vh", left: "10vw", width: "40vw", height: "40vh" },
              { top: "-30vh", left: "5vw", width: "35vw", height: "30vh" },
              { top: "10vh", right: "10vw", width: "30vw", height: "30vh" },
              { bottom: "0vh", right: "5vw", width: "35vw", height: "40vh" },
              { top: "20vh", left: "50%", width: "25vw", height: "25vh" },
              { bottom: "10vh", left: "15vw", width: "30vw", height: "30vh" },
              { top: "5vh", right: "20vw", width: "28vw", height: "35vh" },
            ];

            const pos = positions[i] || positions[0];

            return (
              <motion.div
                key={i}
                style={{
                  position: "absolute",
                  ...pos,
                  scale: scaleTransforms[i] || scaleTransforms[0],
                }}
                className="origin-center"
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover rounded-lg"
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ZoomParallax;
