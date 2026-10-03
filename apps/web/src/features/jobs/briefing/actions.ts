"use server";

import { and, desc, eq } from "drizzle-orm";
import { Output, generateText } from "ai";
import { z } from "zod";

import { db, jobBriefs } from "@harly/db";
import { requirePermission } from "@/features/workspaces/permissions-server";
import { getWorkspaceContext } from "@/features/workspaces/context";
import { getWorkspaceAiConfig } from "@/lib/ai/config";
import { getModel } from "@/lib/ai/registry";
import { generateJobDraftAction } from "../actions";
import { jobDraftSchema } from "@/lib/ai/schemas";
import {
  briefAnswersSchema,
  briefProfileSchema,
  briefTopics,
  fallbackProfile,
  profileAsText,
  type BriefAnswer,
} from "./model";

const nextQuestionSchema = z.object({ question: z.string().min(10).max(400) });

export async function listJobBriefs() {
  const context = await getWorkspaceContext();
  return db.select({
    id: jobBriefs.id,
    title: jobBriefs.title,
    createdAt: jobBriefs.createdAt,
    jobId: jobBriefs.jobId,
  }).from(jobBriefs)
    .where(eq(jobBriefs.workspaceId, context.organization.id))
    .orderBy(desc(jobBriefs.createdAt));
}

export async function getJobBrief(id: string) {
  const context = await requirePermission("jobs:create");
  const [row] = await db.select().from(jobBriefs).where(and(
    eq(jobBriefs.id, id),
    eq(jobBriefs.workspaceId, context.organization.id),
  )).limit(1);
  return row ?? null;
}

export async function createJobBriefAction(input: { title: string }) {
  const context = await requirePermission("jobs:create");
  const title = input.title.trim();
  if (title.length < 3 || title.length > 160) {
    return { ok: false as const, error: "Укажите название позиции (от 3 до 160 символов)." };
  }
  const [brief] = await db.insert(jobBriefs).values({
    workspaceId: context.organization.id,
    createdById: context.user.id,
    title,
  }).returning({ id: jobBriefs.id });
  return { ok: true as const, briefId: brief.id };
}

export async function answerJobBriefAction(input: { briefId: string; answer: string }) {
  const brief = await getJobBrief(input.briefId);
  if (!brief) return { ok: false as const, error: "Бриф не найден." };
  const answers = briefAnswersSchema.parse(brief.answers);
  const topic = briefTopics[answers.length];
  if (!topic) return { ok: false as const, error: "Все вопросы уже отвечены." };
  const answer = input.answer.trim();
  if (answer.length < 2 || answer.length > 5000) {
    return { ok: false as const, error: "Ответ должен содержать от 2 до 5000 символов." };
  }
  const currentQuestion = typeof brief.currentQuestion === "string" && brief.currentQuestion
    ? brief.currentQuestion : topic.question;
  const nextAnswers: BriefAnswer[] = [...answers, { topic: topic.key, question: currentQuestion, answer }];
  const nextTopic = briefTopics[nextAnswers.length];
  let nextQuestion: string | null = nextTopic?.question ?? null;
  let aiUsed = false;
  if (nextTopic) {
    const context = await requirePermission("jobs:create");
    const config = await getWorkspaceAiConfig(context.organization.id);
    if (config) {
      try {
        const result = await generateText({
          model: getModel(config),
          system: "Ты опытный HR-партнёр. Задавай руководителю один уточняющий вопрос на русском языке. Не повторяй уже выясненное. Не спрашивай о возрасте, поле, семейном положении и других защищённых признаках кандидата.",
          prompt: `Позиция: ${brief.title}\nУже полученные ответы: ${JSON.stringify(nextAnswers)}\nСледующая тема: ${nextTopic.key}. Базовый вопрос: ${nextTopic.question}. Сделай следующий вопрос конкретным для этой позиции, сохранив смысл темы.`,
          output: Output.object({ schema: nextQuestionSchema }),
        });
        if (result.output) {
          nextQuestion = result.output.question;
          aiUsed = true;
        }
      } catch {
        // The fixed question keeps the briefing usable before AI is configured
        // and if a provider temporarily fails.
      }
    }
  }
  await db.update(jobBriefs).set({
    answers: nextAnswers,
    currentQuestion: nextQuestion,
    profile: null,
    generatedDraft: null,
    updatedAt: new Date(),
  }).where(eq(jobBriefs.id, brief.id));
  return { ok: true as const, answers: nextAnswers, nextQuestion, aiUsed };
}

export async function compileJobBriefAction(input: { briefId: string }) {
  const brief = await getJobBrief(input.briefId);
  if (!brief) return { ok: false as const, error: "Бриф не найден." };
  const answers = briefAnswersSchema.parse(brief.answers);
  if (answers.length !== briefTopics.length) {
    return { ok: false as const, error: "Сначала ответьте на все вопросы." };
  }
  let profile = fallbackProfile(answers);
  let aiUsed = false;
  const context = await requirePermission("jobs:create");
  const config = await getWorkspaceAiConfig(context.organization.id);
  if (config) {
    try {
      const result = await generateText({
        model: getModel(config),
        system: "Ты HR-партнёр. Составь внутренний профиль позиции на русском языке строго по ответам руководителя. Не выдумывай зарплату, льготы, квалификации и условия. Сохраняй различие между обязательным и желательным. Не включай защищённые личные признаки.",
        prompt: `Позиция: ${brief.title}\nОтветы руководителя: ${JSON.stringify(answers)}`,
        output: Output.object({ schema: briefProfileSchema }),
      });
      if (result.output) {
        profile = result.output;
        aiUsed = true;
      }
    } catch {
      // Preserve the manager's answers verbatim if generation fails.
    }
  }
  await db.update(jobBriefs).set({ profile, updatedAt: new Date() })
    .where(eq(jobBriefs.id, brief.id));
  return { ok: true as const, profile, aiUsed };
}

export async function generateDescriptionFromBriefAction(input: { briefId: string }) {
  const brief = await getJobBrief(input.briefId);
  if (!brief) return { ok: false as const, error: "Бриф не найден." };
  const profile = briefProfileSchema.safeParse(brief.profile);
  if (!profile.success) return { ok: false as const, error: "Сначала составьте профиль позиции." };
  const result = await generateJobDraftAction({
    title: brief.title,
    profile: profileAsText(profile.data),
    language: "ru",
  });
  if (!result.ok) return result;
  const draft = jobDraftSchema.parse(result.draft);
  await db.update(jobBriefs).set({ generatedDraft: draft, updatedAt: new Date() })
    .where(eq(jobBriefs.id, brief.id));
  return { ok: true as const, draft };
}
