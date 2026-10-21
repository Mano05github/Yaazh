import type { Metadata } from "next";

import { CatalogExperience } from "@/components/catalog-experience";

export const metadata: Metadata = {
  title: "Music — Yaazh",
  description: "Discover music to listen to together on Yaazh.",
};

export default function MusicPage() {
  return <CatalogExperience mode="music" />;
}
