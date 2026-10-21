export type CatalogMode = "music" | "watch";

export type CatalogItem = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationSeconds: number | null;
  publishedAt: string;
};

export type CatalogResponse = {
  configured: boolean;
  mode: CatalogMode;
  query: string;
  items: CatalogItem[];
  nextPageToken: string | null;
  message?: string;
};
