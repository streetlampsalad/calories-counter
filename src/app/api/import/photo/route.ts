import { getNotesReader } from "@/features/import/notes-reader";
import { handlePhoto } from "@/features/import/photo-handler";
import { createClient } from "@/lib/supabase/server";

// Runs on the Node.js runtime, which is the default (and the only one Cache Components allows).
export async function POST(request: Request) {
  return handlePhoto(request, {
    userId: async () => {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      return data?.claims.sub ?? null;
    },
    reader: getNotesReader(),
  });
}
