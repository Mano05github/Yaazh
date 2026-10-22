"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CatalogMode, CatalogResponse } from "@/lib/catalog/types";

export async function fetchRoomCatalog({
  roomId,
  mode,
  query,
}: {
  roomId: string;
  mode: CatalogMode;
  query: string;
}) {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Your room session has expired. Please rejoin the room.");

  const parameters = new URLSearchParams({ roomId, mode });
  if (query) parameters.set("q", query);
  const response = await fetch(`/api/catalog/youtube?${parameters}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json()) as CatalogResponse & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? "The catalogue could not be loaded.");
  return payload;
}
