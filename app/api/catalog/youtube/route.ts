import { z } from "zod";

import { getYouTubeCatalog } from "@/lib/catalog/youtube";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  mode: z.enum(["music", "watch"]).default("music"),
  roomId: z.string().uuid(),
  q: z.string().trim().max(80).default(""),
  pageToken: z.string().trim().max(256).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = requestSchema.safeParse({
    mode: url.searchParams.get("mode") ?? undefined,
    roomId: url.searchParams.get("roomId") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    pageToken: url.searchParams.get("pageToken") ?? undefined,
  });

  if (!result.success) {
    return Response.json({ message: "Invalid catalogue request." }, { status: 400 });
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return Response.json({ message: "Authentication is required." }, { status: 401 });
  }

  try {
    const supabase = createAuthenticatedSupabaseClient(accessToken);
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return Response.json({ message: "Your room session has expired." }, { status: 401 });
    }

    const { data: activeRoom, error: roomError } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", result.data.roomId)
      .maybeSingle();
    if (roomError || !activeRoom) {
      return Response.json({ message: "You cannot access this room catalogue." }, { status: 403 });
    }

    const action = result.data.q ? "search" : "browse";
    const { data: rateData, error: rateError } = await supabase.rpc(
      "consume_catalog_rate_limit",
      { p_action: action },
    );
    if (rateError) throw new Error("Catalogue rate limiting is unavailable.");
    const rate = (rateData as Array<{
      allowed: boolean;
      remaining: number;
      retry_after_seconds: number;
    }> | null)?.[0];
    if (!rate?.allowed) {
      return Response.json(
        { message: "Too many catalogue requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rate?.retry_after_seconds ?? 60) },
        },
      );
    }

    const catalog = await getYouTubeCatalog({
      mode: result.data.mode,
      query: result.data.q,
      pageToken: result.data.pageToken,
    });
    return Response.json(catalog, {
      headers: {
        "Cache-Control": "private, max-age=60",
        "Vary": "Authorization",
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    console.error(
      "[catalog/youtube] request failed",
      error instanceof Error ? error.message : "Unknown catalogue error",
    );
    return Response.json(
      { message: "The catalogue is temporarily unavailable." },
      { status: 503 },
    );
  }
}
