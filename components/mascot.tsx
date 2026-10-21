"use client";

import Image, { type StaticImageData } from "next/image";
import { motion } from "framer-motion";

import comfortKiss from "@/public/mascots/comfort-kiss.jpg";
import hug from "@/public/mascots/hug.jpg";
import phonesApart from "@/public/mascots/phones-apart.jpg";
import sleepyCuddle from "@/public/mascots/sleepy-cuddle.jpg";
import sunsetSwing from "@/public/mascots/sunset-swing.jpg";
import videoCall from "@/public/mascots/video-call.jpg";

export type MascotSceneName =
  | "apart"
  | "call"
  | "cuddle"
  | "hug"
  | "kiss"
  | "sunset";

const scenes: Record<
  MascotSceneName,
  { src: StaticImageData; alt: string; fit: "contain" | "cover" }
> = {
  apart: {
    src: phonesApart,
    alt: "Bubu the white panda and Dudu the brown bear staying close by phone",
    fit: "contain",
  },
  call: {
    src: videoCall,
    alt: "Bubu and Dudu reaching toward each other through a video call",
    fit: "cover",
  },
  cuddle: {
    src: sleepyCuddle,
    alt: "Bubu and Dudu resting together",
    fit: "cover",
  },
  hug: {
    src: hug,
    alt: "Bubu and Dudu hugging with little hearts around them",
    fit: "contain",
  },
  kiss: {
    src: comfortKiss,
    alt: "Bubu giving Dudu a comforting kiss",
    fit: "contain",
  },
  sunset: {
    src: sunsetSwing,
    alt: "Bubu and Dudu sharing a sunset on a swing",
    fit: "cover",
  },
};

type MascotSceneProps = {
  scene: MascotSceneName;
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export function MascotScene({
  scene,
  className = "",
  priority = false,
  sizes = "(max-width: 620px) 82vw, 420px",
}: MascotSceneProps) {
  const artwork = scenes[scene];

  return (
    <motion.figure
      className={`mascot-scene mascot-scene-${scene} ${className}`}
      initial={false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Image
        src={artwork.src}
        alt={artwork.alt}
        fill
        priority={priority}
        placeholder="blur"
        sizes={sizes}
        className={`mascot-scene-image is-${artwork.fit}`}
      />
    </motion.figure>
  );
}

export function MascotPair({ joined = false }: { joined?: boolean }) {
  return (
    <motion.div
      className={`mascot-pair ${joined ? "is-joined" : ""}`}
      initial={false}
      animate={{ scale: joined ? 1 : 0.96 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <MascotScene scene={joined ? "hug" : "apart"} sizes="(max-width: 620px) 82vw, 360px" />
      <motion.span
        className="pair-heart"
        aria-hidden="true"
        initial={false}
        animate={{ opacity: joined ? 1 : 0.5, scale: joined ? 1 : 0.78 }}
      >
        ♥
      </motion.span>
    </motion.div>
  );
}
