import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabaseEnvironment = z.object({
  url: z.string().url(),
  key: z.string().min(20),
});

export function createAuthenticatedSupabaseClient(accessToken: string) {
  const environment = supabaseEnvironment.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return createClient(environment.url, environment.key, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
