import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

if (!SUPABASE_URL || SUPABASE_URL.indexOf("YOUR_SUPABASE") !== -1) {
  console.error(
    "Missing Supabase config. Edit js/config.js and fill in your project's URL and anon key (see README.md)."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
