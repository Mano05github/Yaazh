import { z } from "zod";

import { getYouTubeCatalog } from "@/lib/catalog/youtube";

const requestSchema = z.object({
  mode: z.enum(["music", "watch"]).default("music"),
  q: z.string().trim().max(80).default(""),
  pageToken: z.string().trim().max(256).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = requestSchema.safeParse({
    mode: url.searchParams.get("mode") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    pageToken: url.searchParams.get("pageToken") ?? undefined,
  });

  if (!result.success) {
    return Response.json({ message: "Invalid catalogue request." }, { status: 400 });
  }

  try {
    return Response.json(await getYouTubeCatalog({
      mode: result.data.mode,
      query: result.data.q,
      pageToken: result.data.pageToken,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube catalogue is unavailable.";
    return Response.json({ message }, { status: 502 });
  }
}
