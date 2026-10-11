import { after, NextResponse, type NextRequest } from "next/server";
import { authorizeCron } from "@/server/cron-auth";
import { processHiringReviewQueue } from "@/features/applications/hiring-review/queue";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const auth = await authorizeCron(request, "hiring-reviews");
  if (!auth.ok) return auth.response;
  after(async () => {
    try {
      await processHiringReviewQueue();
    } finally {
      await auth.release();
    }
  });
  return NextResponse.json({ ok: true });
}
