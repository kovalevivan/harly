import type { Metadata } from "next";
import { ExternalBriefingClient } from "@/features/jobs/briefing/ExternalBriefingClient";
export const metadata: Metadata = {
  title: "Брифинг руководителя — Harly",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ inviteId: string }>;
}) {
  const { inviteId } = await params;
  return <ExternalBriefingClient inviteId={inviteId} />;
}
