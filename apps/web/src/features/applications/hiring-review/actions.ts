"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, applications, candidates, jobs, jobBriefs } from "@harly/db";
import { Output, generateText } from "ai";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  can,
  requireApplicationPermission,
  requireCandidatePermission,
} from "@/features/workspaces/permissions-server";
import { getWorkspaceAiConfig } from "@/lib/ai/config";
import { getModel } from "@/lib/ai/registry";
import { withUntrustedDataGuardrail } from "@/lib/ai/prompts/guardrails";
import { loadResumeText } from "@/lib/resume/load-resume-text";
import { extractResumeText } from "@/lib/resume/extract-text";
import { savedVacancyDraft } from "@/features/jobs/briefing/job-description";
import {
  groundAssessments,
  readEmployeeProfile,
  readIntake,
  resumeAnalysisSchema,
  resumeReviewsSchema,
  reviewReference,
} from "@/features/jobs/briefing/workflow";
import { leaseFree, versionMatch } from "@/features/jobs/briefing/service";

async function reviewContext(
  applicationId: string,
  permission: "candidates:view" | "collab:write",
) {
  z.uuid().parse(applicationId);
  const context = await requireApplicationPermission(permission, applicationId);
  const [row] = await db
    .select({ application: applications, candidate: candidates, job: jobs })
    .from(applications)
    .innerJoin(
      candidates,
      and(
        eq(candidates.id, applications.candidateId),
        eq(candidates.workspaceId, context.organization.id),
        isNull(candidates.deletedAt),
      ),
    )
    .innerJoin(
      jobs,
      and(
        eq(jobs.id, applications.jobId),
        eq(jobs.workspaceId, context.organization.id),
        isNull(jobs.deletedAt),
      ),
    )
    .where(
      and(
        eq(applications.id, applicationId),
        eq(applications.workspaceId, context.organization.id),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Отклик не найден.");
  await requireCandidatePermission(permission, row.candidate.id);
  const briefs = await db
    .select()
    .from(jobBriefs)
    .where(
      and(
        eq(jobBriefs.jobId, row.job.id),
        eq(jobBriefs.workspaceId, context.organization.id),
      ),
    )
    .orderBy(desc(jobBriefs.updatedAt));
  const brief = briefs[0];
  const profile = brief ? readEmployeeProfile(brief.profile) : null;
  const intake = readIntake(brief?.intake);
  const vacancy = savedVacancyDraft(row.job);
  const ready = Boolean(
    brief && profile && intake.profileApproved && intake.vacancyApproved,
  );
  return {
    ...row,
    brief,
    briefs,
    profile,
    vacancy,
    ready,
    reference: profile ? reviewReference(profile, vacancy) : "",
    workspaceId: context.organization.id,
  };
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
    const { brief, profile } = state;
    if (!brief || !profile || !state.ready)
      return {
        ok: false as const,
        error:
          "Для вакансии ещё не утверждены профиль и описание. Передайте её HR для завершения подготовки.",
      };
    if (
      parsed.expectedVersion !== brief.updatedAt.toISOString() ||
      parsed.expectedReference !== state.reference
    )
      return {
        ok: false as const,
        error:
          "Профиль или вакансия изменились. Обновите данные и повторите разбор.",
      };
    const reviews = resumeReviewsSchema.parse(brief.resumeReviews);
    if (reviews.length >= 30)
      return {
        ok: false as const,
        error: "Достигнут лимит сохранённых разборов для этой вакансии.",
      };
    let resumeText = parsed.resumeText.trim();
    if (!resumeText)
      resumeText =
        (
          await loadResumeText({
            workspaceId: state.workspaceId,
            candidateId: state.candidate.id,
          })
        ).text?.trim() ?? "";
    if (resumeText.length < 50 || resumeText.length > 20000)
      return {
        ok: false as const,
        error:
          "Загрузите резюме в карточку кандидата или вставьте текст от 50 до 20 000 символов.",
      };
    const config = await getWorkspaceAiConfig(state.workspaceId);
    if (!config)
      return {
        ok: false as const,
        error: "Подключите ИИ в настройках для анализа резюме.",
      };
    const result = await generateText({
      model: getModel(config),
      abortSignal: AbortSignal.timeout(60000),
      system: withUntrustedDataGuardrail(
        "Ты помощник HR. Сравни резюме с утверждённым профилем сотрудника и сохранённым описанием вакансии из редактора Harly. Пиши по-русски. Не оценивай личность, здоровье, возраст, пол, семейный статус и внешность. Не делай выводов о пригодности или решения о найме. Для каждого переданного id верни confirmed/mismatch/unverified, дословную цитату evidence или null, explanation и уточняющий question. confirmed и mismatch допустимы только с точной цитатой из резюме. Отсутствие сведений — unverified, не mismatch. Поведение и критерии с verification=interview/work_sample всегда unverified. summary — описание подтверждений и неизвестного, без рейтинга, процента соответствия или рекомендации отказать. Используй только переданные критерии.",
      ),
      prompt: JSON.stringify({
        profile,
        vacancy: state.vacancy,
        resume: resumeText,
      }),
      output: Output.object({ schema: resumeAnalysisSchema }),
    });
    if (!result.output) throw new Error("empty");
    const review = {
      ...result.output,
      assessments: groundAssessments(
        profile.criteria,
        resumeText,
        result.output,
      ),
      id: randomUUID(),
      applicationId: state.application.id,
      candidateId: state.candidate.id,
      candidateName: `${state.candidate.firstName} ${state.candidate.lastName}`,
      resumeText,
      createdAt: new Date().toISOString(),
      reference: state.reference,
      criteria: profile.criteria,
      vacancySnapshot: state.vacancy,
    };
    // Reject late results if the profile, saved editor content or application changed during the model call.
    const [saved] = await db
      .update(jobBriefs)
      .set({
        resumeReviews: [...reviews, review],
        updatedAt: new Date(
          Math.max(Date.now(), brief.updatedAt.getTime() + 1),
        ),
      })
      .where(
        and(
          eq(jobBriefs.id, brief.id),
          eq(jobBriefs.workspaceId, state.workspaceId),
          versionMatch(parsed.expectedVersion),
          leaseFree(),
          sql`exists (select 1 from ${jobs} inner join ${applications} on ${applications.jobId} = ${jobs.id} inner join ${candidates} on ${candidates.id} = ${applications.candidateId} where ${jobs.id} = ${state.job.id} and ${jobs.workspaceId} = ${state.workspaceId} and date_trunc('milliseconds', ${jobs.updatedAt}) = ${state.job.updatedAt.toISOString()}::timestamptz and ${jobs.deletedAt} is null and ${applications.id} = ${state.application.id} and ${applications.candidateId} = ${state.candidate.id} and ${applications.workspaceId} = ${state.workspaceId} and ${candidates.deletedAt} is null)`,
        ),
      )
      .returning({ updatedAt: jobBriefs.updatedAt });
    if (!saved)
      return {
        ok: false as const,
        error:
          "Профиль, вакансия или отклик изменились во время разбора. Результат не сохранён; обновите данные и повторите.",
      };
    revalidatePath(`/dashboard/candidates/${state.candidate.id}`);
    return {
      ok: true as const,
      review,
      version: saved.updatedAt.toISOString(),
    };
  } catch {
    return {
      ok: false as const,
      error:
        "Не удалось выполнить или сохранить разбор. Ваш текст остался в поле. Обновите данные и повторите.",
    };
  }
}

export async function extractApplicationResumeAction(
  applicationId: string,
  form: FormData,
) {
  try {
    await reviewContext(applicationId, "collab:write");
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
  } catch {
    return {
      ok: false as const,
      error:
        "Не удалось прочитать файл. Проверьте доступ, попробуйте другой формат или вставьте текст.",
    };
  }
}
