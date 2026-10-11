"use server";

import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, applications, candidateFiles } from "@harly/db";
import {
  loadReviewQueueDetail,
  enqueueHiringReview,
  processHiringReviewQueue,
} from "./queue";
import { enqueueAttachedResumeReviews } from "./attached-resume";
import { loadHiringReviewSummaries } from "./summary-data";
import { z } from "zod";
import { loadResumeText } from "@/lib/resume/load-resume-text";
import { revalidatePath } from "next/cache";
import {
  can,
  requireApplicationPermission,
  requireCandidatePermission,
} from "@/features/workspaces/permissions-server";
import { extractResumeText } from "@/lib/resume/extract-text";
import { loadHiringReviewContext, performHiringReview } from "./service";
import { resumeReviewsSchema } from "@/features/jobs/briefing/workflow";

async function reviewContext(
  applicationId: string,
  permission: "candidates:view" | "collab:write",
) {
  z.uuid().parse(applicationId);
  const context = await requireApplicationPermission(permission, applicationId);
  const state = await loadHiringReviewContext(
    applicationId,
    context.organization.id,
  );
  await requireCandidatePermission(permission, state.candidate.id);
  return state;
}

export async function getApplicationHiringReviewAction(applicationId: string) {
  try {
    const state = await reviewContext(applicationId, "candidates:view");
    const reviews = state.briefs
      .flatMap((brief) => resumeReviewsSchema.parse(brief.resumeReviews))
      .filter((review) => review.applicationId === applicationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      ok: true as const,
      data: {
        queue: await loadReviewQueueDetail(state.workspaceId, applicationId),
        jobId: state.job.id,
        jobTitle: state.job.title,
        briefId: state.brief?.id ?? null,
        profile: state.profile,
        ready: state.ready,
        reference: state.reference,
        version: state.brief?.updatedAt.toISOString() ?? "",
        reviews,
        canWrite: await can("collab:write"),
        canEditPlan: await can("jobs:create"),
      },
    };
  } catch {
    return {
      ok: false as const,
      error:
        "Не удалось загрузить профиль и разборы этого отклика. Проверьте доступ и повторите.",
    };
  }
}

export async function reviewApplicationResumeAction(input: {
  applicationId: string;
  expectedVersion: string;
  expectedReference: string;
  resumeText: string;
}) {
  try {
    const parsed = z
      .object({
        applicationId: z.uuid(),
        expectedVersion: z.iso.datetime(),
        expectedReference: z.string().max(100000),
        resumeText: z.string().max(20000),
      })
      .parse(input);
    const state = await reviewContext(parsed.applicationId, "collab:write");
    if (parsed.expectedReference !== state.reference)
      return {
        ok: false as const,
        error:
          "Профиль или вакансия изменились. Обновите данные и повторите разбор.",
      };
    const result = await performHiringReview(
      state,
      parsed.resumeText,
      parsed.expectedVersion,
    );
    if (result.ok)
      revalidatePath(`/dashboard/candidates/${state.candidate.id}`);
    return result;
  } catch {
    return {
      ok: false as const,
      error:
        "Не удалось выполнить или сохранить разбор. Ваш текст остался в поле. Обновите данные и повторите.",
    };
  }
}

async function readUploadedResume(form: FormData) {
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 10 * 1024 * 1024 ||
    !/\.(pdf|docx|txt)$/i.test(file.name)
  )
    return {
      ok: false as const,
      error: "Выберите PDF, DOCX или TXT до 10 МБ.",
    };
  const result = await extractResumeText({
    buffer: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
  });
  const text = result.text.trim();
  if (text.length < 50 || text.length > 20000)
    return {
      ok: false as const,
      error:
        "Нужна текстовая версия резюме от 50 до 20 000 символов. Для скана вставьте текст вручную.",
    };
  return { ok: true as const, text };
}

export async function extractApplicationResumeAction(
  applicationId: string,
  form: FormData,
) {
  try {
    await reviewContext(applicationId, "collab:write");
    return await readUploadedResume(form);
  } catch {
    return {
      ok: false as const,
      error:
        "Не удалось прочитать файл. Проверьте доступ, попробуйте другой формат или вставьте текст.",
    };
  }
}

export async function uploadApplicationResumeAction(
  applicationId: string,
  form: FormData,
) {
  try {
    const state = await reviewContext(applicationId, "collab:write");
    const read = await readUploadedResume(form);
    if (!read.ok) return read;
    const result = await enqueueHiringReview(state, read.text);
    if (result.ok && result.willRun)
      after(() => processHiringReviewQueue(result.jobId));
    revalidatePath(`/dashboard/candidates/${state.candidate.id}`);
    return { ...result, text: read.text };
  } catch {
    return {
      ok: false as const,
      error:
        "Не удалось загрузить резюме и запустить разбор. Повторите попытку.",
    };
  }
}

export async function queueApplicationResumeAction(
  applicationId: string,
  resumeText: string,
) {
  try {
    const state = await reviewContext(applicationId, "collab:write");
    z.string().max(20000).parse(resumeText);
    const text =
      resumeText.trim() ||
      (
        await loadResumeText({
          workspaceId: state.workspaceId,
          candidateId: state.candidate.id,
        })
      ).text ||
      "";
    const result = await enqueueHiringReview(state, text);
    if (result.ok && result.willRun)
      after(() => processHiringReviewQueue(result.jobId));
    revalidatePath(`/dashboard/candidates/${state.candidate.id}`);
    return result;
  } catch {
    return {
      ok: false as const,
      error:
        "Не удалось запустить разбор. Текст резюме сохранён в поле; повторите попытку.",
    };
  }
}

export async function getHiringReviewStatusesAction(applicationIds: string[]) {
  try {
    z.array(z.uuid()).max(100).parse(applicationIds);
    const visible: Array<{ id: string; jobId: string }> = [];
    let workspaceId = "";
    for (const id of applicationIds) {
      const context = await requireApplicationPermission("candidates:view", id);
      if (workspaceId && workspaceId !== context.organization.id)
        throw new Error("scope");
      workspaceId = context.organization.id;
    }
    if (!applicationIds.length) return { ok: true as const, summaries: [] };
    const rows = await db
      .select({
        id: applications.id,
        jobId: applications.jobId,
        candidateId: applications.candidateId,
      })
      .from(applications)
      .where(
        and(
          eq(applications.workspaceId, workspaceId),
          inArray(applications.id, applicationIds),
        ),
      );
    for (const row of rows) {
      await requireCandidatePermission("candidates:view", row.candidateId);
      visible.push({ id: row.id, jobId: row.jobId });
    }
    return {
      ok: true as const,
      summaries: await loadHiringReviewSummaries(workspaceId, visible),
    };
  } catch {
    return {
      ok: false as const,
      error: "Не удалось обновить статус разбора. Повторите загрузку страницы.",
    };
  }
}

export async function reviewAttachedCandidateFileAction(
  candidateId: string,
  fileId: string,
) {
  try {
    z.uuid().parse(candidateId);
    z.uuid().parse(fileId);
    const context = await requireCandidatePermission(
      "collab:write",
      candidateId,
    );
    const [file] = await db
      .select({
        fileUrl: candidateFiles.fileUrl,
        fileName: candidateFiles.fileName,
      })
      .from(candidateFiles)
      .where(
        and(
          eq(candidateFiles.id, fileId),
          eq(candidateFiles.candidateId, candidateId),
          eq(candidateFiles.workspaceId, context.organization.id),
        ),
      )
      .limit(1);
    if (!file)
      return {
        ok: false as const,
        error: "Резюме не найдено в карточке этого кандидата.",
      };
    await enqueueAttachedResumeReviews({
      workspaceId: context.organization.id,
      candidateId,
      ...file,
    });
    revalidatePath(`/dashboard/candidates/${candidateId}`);
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error:
        "Не удалось запустить разбор сохранённого резюме. Проверьте доступ и повторите попытку.",
    };
  }
}
