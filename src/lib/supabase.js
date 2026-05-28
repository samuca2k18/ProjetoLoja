import { createClient } from "@supabase/supabase-js";

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

export const isSupabaseConfigured =
  Boolean(supabaseConfig.url) &&
  Boolean(supabaseConfig.publishableKey) &&
  !supabaseConfig.url.includes("SEU-PROJETO");

export const supabase = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;
