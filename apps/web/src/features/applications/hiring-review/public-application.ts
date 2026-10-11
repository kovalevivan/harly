import "server-only";

import { after } from "next/server";
import type { VerifiedResumeUpload } from "../resume-upload";
import { extractResumeText } from "@/lib/resume/extract-text";
import { isWorkspaceStorageKey } from "@/lib/storage-validation";
import { privateResumeFileUrl } from "@/lib/resume/storage-key";
import { loadHiringReviewContext } from "./service";
import { enqueueHiringReview, processHiringReviewQueue } from "./queue";

/** Internal post-commit hook, not a public server action. Both public submission
 * paths call it with server-created IDs and bytes verified by the transaction.
 * It targets only the accepted application, never the candidate's other jobs.
 */
export async function enqueuePublicApplicationReview(input: {
  applicationId: string;
  workspaceId: string;
  resume: VerifiedResumeUpload;
}) {
  try {
    const { resume } = input;
    if (
      !isWorkspaceStorageKey(input.workspaceId, resume.key, "resumes") ||
      resume.fileUrl !== privateResumeFileUrl(resume.key)
    )
      return;
    const state = await loadHiringReviewContext(
      input.applicationId,
      input.workspaceId,
    );
    const snapshot = state.application.snapshot;
    if (
      state.workspaceId !== input.workspaceId ||
      state.application.id !== input.applicationId ||
      state.application.source !== "public_form" ||
      state.application.status !== "active" ||
      !snapshot ||
      typeof snapshot !== "object" ||
      !("resumeUrl" in snapshot) ||
      snapshot.resumeUrl !== resume.fileUrl ||
      !state.ready
    )
      return;

    let text = "";
    try {
      text = (
        await extractResumeText({
          buffer: Buffer.from(resume.bytes),
          fileName: resume.fileName,
          mimeType: resume.fileType,
        })
      ).text;
    } catch {
      // Preserve the accepted application and show a failed-read status to HR.
    }
    const queued = await enqueueHiringReview(state, text);
    if (queued.ok && queued.willRun)
      after(async () => {
        try {
          await processHiringReviewQueue(queued.jobId);
        } catch {
          // The persisted task remains recoverable by the scheduler.
          console.error("Could not start a public application profile review.");
        }
      });
  } catch {
    // Queue/worker failures must not turn a committed submission into an error
    // or expose resume data, credentials, or internal exceptions to candidates.
    console.error("Could not queue a public application profile review.");
  }
}
