import "server-only";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, applications } from "@harly/db";
import { storage } from "@/lib/storage";
import { resumeKeyFromUrl } from "@/lib/resume/storage-key";
import { isWorkspaceStorageKey } from "@/lib/storage-validation";
import { extractResumeText } from "@/lib/resume/extract-text";
import {
  requireCandidatePermission,
  requireApplicationPermission,
} from "@/features/workspaces/permissions-server";
import { loadHiringReviewContext } from "./service";
import { enqueueHiringReview, processHiringReviewQueue } from "./queue";
// Called only after an authenticated, authorized candidate file attachment.
export async function enqueueAttachedResumeReviews(input: {
  workspaceId: string;
  candidateId: string;
  fileUrl: string;
  fileName: string;
}) {
  const context = await requireCandidatePermission(
    "collab:write",
    input.candidateId,
  );
  if (context.organization.id !== input.workspaceId) throw new Error("scope");
  const key = resumeKeyFromUrl(input.fileUrl);
  if (!key || !isWorkspaceStorageKey(input.workspaceId, key, "resumes")) return;
  let text = "";
  try {
    text = (
      await extractResumeText({
        buffer: await storage.read(key),
        fileName: input.fileName,
      })
    ).text;
  } catch {
    /* Queue a visible failed read without dropping the uploaded file. */
  }
  const rows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.workspaceId, input.workspaceId),
        eq(applications.candidateId, input.candidateId),
      ),
    );
  for (const row of rows) {
    try {
      await requireApplicationPermission("collab:write", row.id);
      const state = await loadHiringReviewContext(row.id, input.workspaceId);
      if (state.workspaceId !== input.workspaceId) continue;
      const result = await enqueueHiringReview(state, text);
      if (result.ok && result.willRun)
        after(() => processHiringReviewQueue(result.jobId));
    } catch {
      /* Inaccessible applications are not queued or disclosed. */
    }
  }
}
