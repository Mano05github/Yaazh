"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const publicSupabaseEnvironment = z.object({
  url: z.string().url(),
  key: z.string().min(20),
});

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const environment = publicSupabaseEnvironment.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!environment.success) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    );
  }

  browserClient = createClient(environment.data.url, environment.data.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
