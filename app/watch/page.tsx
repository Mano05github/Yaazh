import type { Metadata } from "next";

import { CatalogExperience } from "@/components/catalog-experience";

export const metadata: Metadata = {
  title: "Watch — Yaazh",
  description: "Discover videos to watch together on Yaazh.",
};

export default function WatchPage() {
  return <CatalogExperience mode="watch" />;
}
