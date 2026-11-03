import { getNotesReader } from "@/features/import/notes-reader";
import {
  handlePhoto,
  PHOTO_DAILY_LIMIT,
} from "@/features/import/photo-handler";
import { createClient } from "@/lib/supabase/server";

// Runs on the Node.js runtime, which is the default (and the only one Cache Components allows).
export async function POST(request: Request) {
  const supabase = await createClient();
  return handlePhoto(request, {
    userId: async () => {
      const { data } = await supabase.auth.getClaims();
      return data?.claims.sub ?? null;
    },
    allowUse: async () => {
      const { data, error } = await supabase.rpc("increment_ai_usage", {
        usage_kind: "photo",
        max_per_day: PHOTO_DAILY_LIMIT,
      });
      if (error) throw error;
      return data;
    },
    reader: getNotesReader(),
  });
}
