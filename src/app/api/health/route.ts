import { connection } from "next/server";
import { healthPayload } from "@/lib/health";

export async function GET() {
  // Opt out of build-time prerendering so every request reports the live deployment.
  await connection();
  return Response.json(healthPayload(process.env), {
    headers: { "Cache-Control": "no-store" },
  });
}
