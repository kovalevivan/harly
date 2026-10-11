"use server";

import { getHarlyPublicOrigin } from "@/lib/public-origin";
import {
  processBriefingMessage,
  createBriefingInvitation,
  completeBriefing,
  versionMatch,
  leaseFree,
} from "./service";
import { briefingLimits } from "./agent";
import { saveBriefAnswers } from "./edit-brief";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { Output, generateText } from "ai";
import { z } from "zod";
import {
  db,
  jobBriefs,
  jobs,
  briefingInvitations,
  type JobBrief,
} from "@harly/db";
import { requirePermission } from "@/features/workspaces/permissions-server";
import { getWorkspaceAiConfig } from "@/lib/ai/config";
import { getModel } from "@/lib/ai/registry";
import { withUntrustedDataGuardrail } from "@/lib/ai/prompts/guardrails";
import { extractResumeText } from "@/lib/resume/extract-text";
import { jobDraftSchema } from "@/lib/ai/schemas";
import { generateJobDraftAction } from "../actions";
import { briefAnswersSchema, fallbackProfile, profileAsText } from "./model";
import { getJobBrief } from "./actions";
import {
  employeeProfileSchema,
  readEmployeeProfile,
  readIntake,
  upgradeProfile,
  type EmployeeProfile,
  type HiringIntake,
} from "./workflow";
import {
  callCenterAnswers,
  callCenterCase,
  callCenterProfile,
  callCenterDraft,
} from "./call-center";

async function updatePlan(
  brief: JobBrief,
  values: Partial<JobBrief>,
  expectedVersion?: string,
) {
  if (expectedVersion && brief.updatedAt.toISOString() !== expectedVersion)
    throw new Error("План изменился. Обновите страницу.");
  const [saved] = await db
    .update(jobBriefs)
    .set({
      ...values,
      updatedAt: new Date(Math.max(Date.now(), brief.updatedAt.getTime() + 1)),
    })
    .where(
      and(
        eq(jobBriefs.id, brief.id),
        eq(jobBriefs.workspaceId, brief.workspaceId),
        versionMatch(brief.updatedAt.toISOString()),
        leaseFree(),
      ),
    )
    .returning({ id: jobBriefs.id, updatedAt: jobBriefs.updatedAt });
  if (!saved)
    throw new Error(
      "План изменился в другой вкладке. Обновите страницу и повторите действие.",
    );
  revalidatePath("/dashboard/jobs");
  revalidatePath(`/dashboard/jobs/briefs/${brief.id}`);
  return saved.updatedAt.toISOString();
}

export async function createCallCenterPlanAction() {
  const context = await requirePermission("jobs:create");
  const [existing] = await db
    .select()
    .from(jobBriefs)
    .where(
      and(
        eq(jobBriefs.workspaceId, context.organization.id),
        eq(jobBriefs.title, callCenterCase.title),
      ),
    )
    .limit(1);
  if (existing) return { ok: true as const, briefId: existing.id };
  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.workspaceId, context.organization.id),
        eq(jobs.slug, "operator-kontakt-centra"),
      ),
    )
    .limit(1);
  const intake: HiringIntake = {
    ...readIntake(null),
    messages: [
      {
        role: "assistant",
        content:
          "Я перенёс требования из предоставленной вакансии. Это исходные данные, а не подтверждённые ответы руководителя. Уточним KPI, нагрузку и обучение. Какие результаты должен показывать оператор после обучения?",
      },
    ],
    profileApproved: false,
    vacancyApproved: false,
    caseId: callCenterCase.id,
  };
  const [plan] = await db
    .insert(jobBriefs)
    .values({
      workspaceId: context.organization.id,
      createdById: context.user.id,
      title: callCenterCase.title,
      answers: callCenterAnswers,
      profile: callCenterProfile,
      generatedDraft: callCenterDraft,
      intake,
      jobId: job?.id ?? null,
    })
    .returning({ id: jobBriefs.id });
  revalidatePath("/dashboard/jobs");
  return { ok: true as const, briefId: plan.id };
}

export async function chatHiringPlanAction(input: {
  briefId: string;
  message: string;
  requestId: string;
  expectedVersion: string;
}) {
  const parsed = z
    .object({
      briefId: z.uuid(),
      message: z.string().trim().min(2).max(5000),
      requestId: z.uuid(),
      expectedVersion: z.iso.datetime(),
    })
    .safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: "Проверьте сообщение и обновите страницу.",
    };
  const brief = await getJobBrief(input.briefId);
  if (!brief) return { ok: false as const, error: "План не найден." };
  try {
    await processBriefingMessage(parsed.data);
    const [saved] = await db
      .select()
      .from(jobBriefs)
      .where(eq(jobBriefs.id, brief.id))
      .limit(1);
    return {
      ok: true as const,
      answers: briefAnswersSchema.parse(saved.answers),
      intake: readIntake(saved.intake),
      updatedAt: saved.updatedAt.toISOString(),
      aiUsed: true,
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось обработать сообщение.",
    };
  }
}

export async function createBriefingInviteAction(briefId: string) {
  const brief = await getJobBrief(briefId);
  if (!brief) throw new Error("План не найден.");
  const invite = await createBriefingInvitation(brief.id);
  revalidatePath(`/dashboard/jobs/briefs/${brief.id}`);
  return {
    id: invite.id,
    updatedAt: invite.updatedAt,
    expiresAt: invite.expiresAt,
    url: `${getHarlyPublicOrigin()}/briefing/${invite.id}#token=${invite.token}`,
  };
}
export async function revokeBriefingInviteAction(
  briefId: string,
  inviteId: string,
) {
  if (!(await getJobBrief(briefId))) throw new Error("План не найден.");
  await db
    .update(briefingInvitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(briefingInvitations.id, inviteId),
        eq(briefingInvitations.briefId, briefId),
      ),
    );
  revalidatePath(`/dashboard/jobs/briefs/${briefId}`);
}
export async function editPlanAnswersAction(input: {
  briefId: string;
  answers: unknown;
  expectedVersion: string;
}) {
  if (!(await getJobBrief(input.briefId))) throw new Error("План не найден.");
  return saveBriefAnswers(
    input.briefId,
    input.answers,
    z.iso.datetime().parse(input.expectedVersion),
  );
}
export async function completePlanBriefingAction(
  briefId: string,
  expectedVersion: string,
) {
  if (!(await getJobBrief(briefId))) throw new Error("План не найден.");
  return completeBriefing(briefId, z.iso.datetime().parse(expectedVersion));
}

export async function compileEmployeeProfileAction(input: {
  briefId: string;
  expectedVersion: string;
}) {
  const brief = await getJobBrief(input.briefId);
  if (!brief) return { ok: false as const, error: "План не найден." };
  if (brief.updatedAt.toISOString() !== input.expectedVersion)
    return { ok: false as const, error: "План изменился. Обновите страницу." };
  const answers = briefAnswersSchema.parse(brief.answers);

  if (!answers.length)
    return {
      ok: false as const,
      error: "Сначала опишите требования в брифинге.",
    };
  const config = await getWorkspaceAiConfig(brief.workspaceId);
  try {
    let profile: EmployeeProfile;
    if (!config) profile = upgradeProfile(fallbackProfile(answers));
    else {
      const result = await generateText({
        model: getModel(config),
        abortSignal: AbortSignal.timeout(60000),
        system: withUntrustedDataGuardrail(
          "Составь внутренний профиль сотрудника по-русски строго из требований руководителя. Сохрани обязательное и желательное отдельно. Добавь критерии трёх категорий: professional — опыт/навыки, business — рабочие результаты, behavioral — наблюдаемые рабочие действия. Каждый критерий получает уникальный id, label, required, verification (resume/interview/work_sample), question. Поведение, дикцию, стрессоустойчивость и реальную эффективность нельзя доказать резюме: verification только interview или work_sample. Не включай защищённые признаки, психологические типы и диагнозы. Не выдумывай числовые KPI, зарплату или условия. Неизвестное укажи как требующее согласования.",
        ),
        prompt: JSON.stringify({ title: brief.title, answers }),
        output: Output.object({ schema: employeeProfileSchema }),
      });
      if (!result.output) throw new Error("empty");
      profile = result.output;
    }
    profile = {
      ...profile,
      criteria: profile.criteria.map((criterion, index) => ({
        ...criterion,
        id: `criterion-${index + 1}`,
        verification:
          criterion.category === "behavioral" &&
          criterion.verification === "resume"
            ? ("work_sample" as const)
            : criterion.verification,
      })),
    };
    const intake = {
      ...readIntake(brief.intake),
      profileApproved: false,
      vacancyApproved: false,
    };
    const updatedAt = await updatePlan(
      brief,
      { profile, generatedDraft: null, intake },
      input.expectedVersion,
    );
    return {
      ok: true as const,
      profile,
      intake,
      updatedAt,
      aiUsed: Boolean(config),
    };
  } catch {
    return {
      ok: false as const,
      error:
        "Не удалось сформировать профиль. Сохранённые требования остались на месте. Повторите действие.",
    };
  }
}

export async function saveEmployeeProfileAction(input: {
  briefId: string;
  expectedVersion: string;
  profile: EmployeeProfile;
}) {
  const parsed = employeeProfileSchema.safeParse(input.profile);
  if (!parsed.success || JSON.stringify(input.profile).length > 50000)
    return {
      ok: false as const,
      error:
        "Проверьте профиль: необходимы критерии и непустые вопросы для их проверки.",
    };
  if (
    new Set(parsed.data.criteria.map((item) => item.id)).size !==
    parsed.data.criteria.length
  )
    return {
      ok: false as const,
      error: "Критерии должны иметь уникальные идентификаторы.",
    };
  if (
    parsed.data.criteria.some(
      (item) =>
        item.category === "behavioral" && item.verification === "resume",
    )
  )
    return {
      ok: false as const,
      error: "Поведение в работе проверяется интервью или кейсом, а не резюме.",
    };
  const brief = await getJobBrief(input.briefId);
  if (!brief) return { ok: false as const, error: "План не найден." };
  const oldProfile = readEmployeeProfile(brief.profile);
  const changed = JSON.stringify(oldProfile) !== JSON.stringify(parsed.data);
  const intake = {
    ...readIntake(brief.intake),
    profileApproved: true,
    ...(changed ? { vacancyApproved: false } : {}),
  };
  try {
    const updatedAt = await updatePlan(
      brief,
      {
        profile: parsed.data,
        intake,
        ...(changed ? { generatedDraft: null } : {}),
      },
      input.expectedVersion,
    );
    return {
      ok: true as const,
      profile: parsed.data,
      intake,
      updatedAt,
      draftCleared: changed,
    };
  } catch {
    return {
      ok: false as const,
      error: "План изменился. Обновите страницу перед сохранением профиля.",
    };
  }
}

export async function generateHiringDescriptionAction(input: {
  briefId: string;
  expectedVersion: string;
}) {
  const brief = await getJobBrief(input.briefId);
  if (!brief) return { ok: false as const, error: "План не найден." };
  const profile = readEmployeeProfile(brief.profile);
  if (!profile || !readIntake(brief.intake).profileApproved)
    return {
      ok: false as const,
      error: "Сначала утвердите профиль сотрудника.",
    };
  const result = await generateJobDraftAction({
    title: brief.title,
    profile: profileAsText(profile),
    language: "ru",
    timeoutMs: briefingLimits.timeoutMs,
  });
  if (!result.ok) return result;
  const intake = { ...readIntake(brief.intake), vacancyApproved: false };
  try {
    const updatedAt = await updatePlan(
      brief,
      { generatedDraft: result.draft, intake },
      input.expectedVersion,
    );
    return { ok: true as const, draft: result.draft, intake, updatedAt };
  } catch {
    return {
      ok: false as const,
      error:
        "План изменился во время генерации. Обновите страницу и повторите.",
    };
  }
}

export async function saveHiringDescriptionAction(input: {
  briefId: string;
  expectedVersion: string;
  draft: z.infer<typeof jobDraftSchema>;
}) {
  const draft = jobDraftSchema.safeParse(input.draft);
  if (
    !draft.success ||
    !draft.data.summary.trim() ||
    !draft.data.sections.length ||
    draft.data.sections.some(
      (s) => !s.title.trim() || !s.bullets.some((b) => b.trim()),
    ) ||
    JSON.stringify(input.draft).length > 50000
  )
    return {
      ok: false as const,
      error: "Проверьте описание и разделы вакансии.",
    };
  const brief = await getJobBrief(input.briefId);
  if (!brief) return { ok: false as const, error: "План не найден." };
  const intake = readIntake(brief.intake);
  if (!intake.profileApproved)
    return {
      ok: false as const,
      error: "Сначала утвердите профиль сотрудника.",
    };
  try {
    const next = { ...intake, vacancyApproved: true };
    const updatedAt = await updatePlan(
      brief,
      { generatedDraft: draft.data, intake: next },
      input.expectedVersion,
    );
    return { ok: true as const, draft: draft.data, intake: next, updatedAt };
  } catch {
    return {
      ok: false as const,
      error: "План изменился. Обновите страницу перед сохранением описания.",
    };
  }
}

export async function attachBriefSourceAction(form: FormData) {
  const briefId = z.uuid().parse(form.get("briefId"));
  const expectedVersion = z.iso.datetime().parse(form.get("expectedVersion"));
  const brief = await getJobBrief(briefId);
  if (!brief) throw new Error("План не найден.");
  const intake = readIntake(brief.intake);
  if (intake.completed)
    throw new Error(
      "Создайте новое приглашение для уточнения завершённого брифа.",
    );
  if (intake.sourceDocuments.length >= 5)
    throw new Error("Можно приложить до пяти документов.");
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    !/\.(pdf|docx|txt)$/i.test(file.name) ||
    !file.size ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Выберите PDF, DOCX или TXT до 10 МБ.");
  const extracted = await extractResumeText({
    buffer: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
  });
  if (!extracted.text.trim() || extracted.text.length > 20000)
    throw new Error(
      "Нужен документ с текстом до 20 000 символов. Скан без текста не подходит.",
    );
  const next = {
    ...intake,
    sourceDocuments: [
      ...intake.sourceDocuments,
      { name: file.name, text: extracted.text },
    ],
    agentHistory: [],
    profileApproved: false,
    vacancyApproved: false,
  };
  const updatedAt = await updatePlan(brief, { intake: next }, expectedVersion);
  return { intake: next, updatedAt };
}
