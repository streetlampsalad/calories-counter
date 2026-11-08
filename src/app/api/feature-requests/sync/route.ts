import { connection } from "next/server";
import { handleFeatureRequestSync } from "@/features/feature-requests/sync-handler";
import { createAdminClient } from "@/lib/supabase/admin";

// Called by the board workflow after every Issue and pull request event (spec 124). Refuses anyone
// without the shared secret before it touches the database.
export async function POST(request: Request) {
  await connection();

  return handleFeatureRequestSync(request, {
    secret: process.env.FEATURE_REQUESTS_SYNC_SECRET,
    apply: async (updates) => {
      const { data, error } = await createAdminClient().rpc(
        "apply_feature_request_sync",
        { updates },
      );
      if (error) throw error;
      return data;
    },
  });
}
