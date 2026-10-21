import "server-only";

import type { CatalogItem, CatalogMode, CatalogResponse } from "@/lib/catalog/types";

type YouTubeThumbnail = { url: string; width?: number; height?: number };

type YouTubeVideo = {
  id: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: Record<string, YouTubeThumbnail>;
  };
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean };
};

type YouTubeListResponse = {
  items?: YouTubeVideo[];
  nextPageToken?: string;
  error?: { message?: string };
};

type YouTubeSearchResponse = {
  items?: Array<{ id?: { videoId?: string } }>;
  nextPageToken?: string;
  error?: { message?: string };
};

const apiBase = "https://www.googleapis.com/youtube/v3";

function durationInSeconds(value?: string) {
  if (!value) return null;
  const match = value.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  return (
    Number(match[1] ?? 0) * 86400 +
    Number(match[2] ?? 0) * 3600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0)
  );
}

function normalizeVideo(video: YouTubeVideo): CatalogItem | null {
  const snippet = video.snippet;
  const thumbnails = snippet?.thumbnails;
  const thumbnail =
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url;

  if (!video.id || !snippet?.title || !thumbnail) return null;
  const title = snippet.title
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
  return {
    id: video.id,
    title,
    channelTitle: snippet.channelTitle ?? "YouTube",
    thumbnail,
    durationSeconds: durationInSeconds(video.contentDetails?.duration),
    publishedAt: snippet.publishedAt ?? "",
  };
}

async function youtubeRequest<T>(path: string, parameters: URLSearchParams, revalidate: number) {
  const response = await fetch(`${apiBase}/${path}?${parameters}`, {
    next: { revalidate },
  });
  const payload = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "YouTube catalogue request failed.");
  }
  return payload;
}

export async function getYouTubeCatalog({
  mode,
  query,
  pageToken,
}: {
  mode: CatalogMode;
  query: string;
  pageToken?: string;
}): Promise<CatalogResponse> {
  const key = process.env.YOUTUBE_DATA_API_KEY;
  if (!key) {
    return {
      configured: false,
      mode,
      query,
      items: [],
      nextPageToken: null,
      message: "Add YOUTUBE_DATA_API_KEY to .env.local to load the YouTube catalogue.",
    };
  }

  const regionCode = process.env.YOUTUBE_REGION_CODE || "IN";
  const categoryId = mode === "music" ? "10" : "24";
  let videos: YouTubeVideo[] = [];
  let nextPageToken: string | null = null;

  if (query) {
    const searchParameters = new URLSearchParams({
      part: "id",
      type: "video",
      maxResults: "24",
      q: query,
      regionCode,
      relevanceLanguage: mode === "music" ? "ta" : "en",
      safeSearch: "moderate",
      videoCategoryId: categoryId,
      videoEmbeddable: "true",
      videoSyndicated: "true",
      key,
    });
    if (pageToken) searchParameters.set("pageToken", pageToken);
    const search = await youtubeRequest<YouTubeSearchResponse>(
      "search",
      searchParameters,
      3600,
    );
    const ids = (search.items ?? [])
      .map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id));
    nextPageToken = search.nextPageToken ?? null;

    if (ids.length) {
      const videoParameters = new URLSearchParams({
        part: "snippet,contentDetails,status",
        id: ids.join(","),
        key,
      });
      const details = await youtubeRequest<YouTubeListResponse>(
        "videos",
        videoParameters,
        3600,
      );
      videos = (details.items ?? []).filter((video) => video.status?.embeddable !== false);
    }
  } else {
    const popularParameters = new URLSearchParams({
      part: "snippet,contentDetails,status",
      chart: "mostPopular",
      maxResults: "24",
      regionCode,
      videoCategoryId: categoryId,
      key,
    });
    if (pageToken) popularParameters.set("pageToken", pageToken);
    const popular = await youtubeRequest<YouTubeListResponse>(
      "videos",
      popularParameters,
      900,
    );
    videos = (popular.items ?? []).filter((video) => video.status?.embeddable !== false);
    nextPageToken = popular.nextPageToken ?? null;
  }

  return {
    configured: true,
    mode,
    query,
    items: videos.map(normalizeVideo).filter((item): item is CatalogItem => Boolean(item)),
    nextPageToken,
  };
}
