import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, or, lte, sql, desc } from "drizzle-orm";
import { db, jobBriefs, briefingInvitations, briefingTurns } from "@harly/db";
import { getWorkspaceAiConfig } from "@/lib/ai/config";
import { recordAiUsage } from "@/lib/ai/usage";
import { briefAnswersSchema } from "./model";
import { intakeSchema, readIntake } from "./workflow";
import { briefingLimits, runBriefingAgent } from "./agent";

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const cookieName = (id: string) => `harly_brief_${id}`;
export const versionMatch = (version: string) =>
  sql`date_trunc('milliseconds', ${jobBriefs.updatedAt}) = ${version}::timestamptz`;
export const leaseFree = () =>
  or(
    isNull(jobBriefs.agentLeaseUntil),
    lte(jobBriefs.agentLeaseUntil, new Date()),
  );

export async function createBriefingInvitation(briefId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + briefingLimits.days * 86400000);
  const row = await db.transaction(async (tx) => {
    const [brief] = await tx
      .select()
      .from(jobBriefs)
      .where(eq(jobBriefs.id, briefId))
      .limit(1);
    if (!brief) throw new Error("План не найден.");
    const updatedAt = new Date(
      Math.max(Date.now(), brief.updatedAt.getTime() + 1),
    );
    const [saved] = await tx
      .update(jobBriefs)
      .set({
        intake: { ...readIntake(brief.intake), completed: false },
        updatedAt,
      })
      .where(
        and(
          eq(jobBriefs.id, briefId),
          versionMatch(brief.updatedAt.toISOString()),
          leaseFree(),
        ),
      )
      .returning({ id: jobBriefs.id });
    if (!saved)
      throw new Error(
        "Брифинг изменился или обрабатывается. Повторите создание ссылки.",
      );
    const [invite] = await tx
      .insert(briefingInvitations)
      .values({ briefId, tokenHash: hashToken(token), expiresAt })
      .returning({ id: briefingInvitations.id });
    return { ...invite, updatedAt: updatedAt.toISOString() };
  });
  return { ...row, token, expiresAt: expiresAt.toISOString() };
}

export async function authorizeInvitation(id: string, token: string) {
  if (
    !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id) ||
    !/^[\w-]{43}$/.test(token)
  )
    return null;
  const [row] = await db
    .select()
    .from(briefingInvitations)
    .where(
      and(
        eq(briefingInvitations.id, id),
        isNull(briefingInvitations.revokedAt),
        gt(briefingInvitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (
    !row ||
    !timingSafeEqual(
      Buffer.from(row.tokenHash, "hex"),
      Buffer.from(hashToken(token), "hex"),
    )
  )
    return null;
  return row;
}

export async function publicBrief(briefId: string) {
  const [brief] = await db
    .select()
    .from(jobBriefs)
    .where(eq(jobBriefs.id, briefId))
    .limit(1);
  if (!brief) return null;
  const { agentHistory, ...intake } = readIntake(brief.intake);
  void agentHistory;
  const [lastTurn] = await db
    .select({
      id: briefingTurns.id,
      message: briefingTurns.message,
      status: briefingTurns.status,
    })
    .from(briefingTurns)
    .where(eq(briefingTurns.briefId, briefId))
    .orderBy(desc(briefingTurns.createdAt))
    .limit(1);
  return {
    title: brief.title,
    answers: briefAnswersSchema.parse(brief.answers),
    intake,
    updatedAt: brief.updatedAt.toISOString(),
    lastTurn,
    busy: Boolean(brief.agentLeaseUntil && brief.agentLeaseUntil > new Date()),
  };
}

export async function processBriefingMessage(input: {
  briefId: string;
  message: string;
  requestId: string;
  expectedVersion: string;
  invitationId?: string;
}) {
  const [brief] = await db
    .select()
    .from(jobBriefs)
    .where(eq(jobBriefs.id, input.briefId))
    .limit(1);
  if (!brief) throw new Error("Брифинг не найден.");
  const [existing] = await db
    .select()
    .from(briefingTurns)
    .where(eq(briefingTurns.id, input.requestId))
    .limit(1);
  if (
    existing &&
    (existing.briefId !== brief.id || existing.message !== input.message)
  )
    throw new Error("Идентификатор запроса уже использован.");
  if (existing?.status === "completed")
    return existing.result as { ok: true; updatedAt: string };
  if (existing?.status === "cancelled")
    throw new Error("Этот запрос отменён. Отправьте сообщение заново.");
  const intake = readIntake(brief.intake);
  if (intake.completed)
    throw new Error(
      "Брифинг уже передан HR. Попросите новую ссылку для уточнений.",
    );
  if (intake.messages.length >= 78)
    throw new Error(
      "Достигнут лимит переписки. Проверьте итог и передайте его HR.",
    );
  if (!existing && brief.updatedAt.toISOString() !== input.expectedVersion)
    throw new Error("Брифинг изменился. Обновите сводку перед отправкой.");
  const [{ count }] = await db
    .select({
      count: sql<number>`coalesce(sum(${briefingTurns.attempts}), 0)::int`,
    })
    .from(briefingTurns)
    .where(
      and(
        eq(briefingTurns.briefId, brief.id),
        gt(briefingTurns.createdAt, new Date(Date.now() - 86400000)),
      ),
    );
  if (count >= briefingLimits.dailyRequests)
    throw new Error("Достигнут дневной лимит запросов. Продолжите завтра.");
  const nextIntake = intakeSchema.parse({
    ...intake,
    messages: existing
      ? intake.messages
      : [...intake.messages, { role: "user", content: input.message }],
  });
  const claimed = await db.transaction(async (tx) => {
    const [locked] = await tx
      .update(jobBriefs)
      .set({
        agentLeaseId: input.requestId,
        agentLeaseUntil: new Date(
          Date.now() + briefingLimits.timeoutMs + 15000,
        ),
        intake: nextIntake,
      })
      .where(
        and(
          eq(jobBriefs.id, brief.id),
          versionMatch(brief.updatedAt.toISOString()),
          leaseFree(),
        ),
      )
      .returning({ id: jobBriefs.id });
    if (!locked) return false;
    if (!existing)
      await tx.insert(briefingTurns).values({
        id: input.requestId,
        briefId: brief.id,
        message: input.message,
      });
    else
      await tx
        .update(briefingTurns)
        .set({
          status: "pending",
          attempts: sql`${briefingTurns.attempts} + 1`,
        })
        .where(eq(briefingTurns.id, input.requestId));
    return true;
  });
  if (!claimed)
    throw new Error(
      "Уже обрабатывается другое сообщение. Дождитесь ответа или обновите страницу.",
    );
  try {
    const config = await getWorkspaceAiConfig(brief.workspaceId);
    if (!config)
      throw new Error(
        "ИИ пока не настроен. Сообщите HR, чтобы он подключил OpenRouter в настройках.",
      );
    const result = await runBriefingAgent({
      id: brief.id,
      title: brief.title,
      answers: briefAnswersSchema.parse(brief.answers),
      intake,
      message: input.message,
      requestId: input.requestId,
      config,
    });
    recordAiUsage({
      surface: "hiring-briefing-agent",
      workspaceId: brief.workspaceId,
      provider: config.provider,
      modelId: config.modelId,
      promptTokens: result.usage.inputTokens,
      completionTokens: result.usage.outputTokens,
    });
    const savedIntake = intakeSchema.parse({
      ...nextIntake,
      profileApproved: false,
      vacancyApproved: false,
      sources: result.sources,
      openQuestions: result.openQuestions,
      agentHistory: result.agentHistory,
      messages: [
        ...nextIntake.messages,
        { role: "assistant", content: result.reply },
      ],
    });
    const updatedAt = new Date(
      Math.max(Date.now(), brief.updatedAt.getTime() + 1),
    );
    const payload = {
      ok: true as const,
      intake: savedIntake,
      answers: result.answers,
      updatedAt: updatedAt.toISOString(),
      aiUsed: true,
    };
    await db.transaction(async (tx) => {
      if (input.invitationId) {
        const [allowed] = await tx
          .select({ id: briefingInvitations.id })
          .from(briefingInvitations)
          .where(
            and(
              eq(briefingInvitations.id, input.invitationId),
              eq(briefingInvitations.briefId, brief.id),
              isNull(briefingInvitations.revokedAt),
              isNull(briefingInvitations.completedAt),
              gt(briefingInvitations.expiresAt, new Date()),
            ),
          )
          .limit(1);
        if (!allowed) throw new Error("Приглашение больше не действует.");
      }
      const [saved] = await tx
        .update(jobBriefs)
        .set({
          answers: result.answers,
          currentQuestion: result.reply,
          intake: savedIntake,
          profile: null,
          generatedDraft: null,
          agentLeaseId: null,
          agentLeaseUntil: null,
          updatedAt,
        })
        .where(
          and(
            eq(jobBriefs.id, brief.id),
            eq(jobBriefs.agentLeaseId, input.requestId),
          ),
        )
        .returning({ id: jobBriefs.id });
      if (!saved)
        throw new Error(
          "Запрос отменён или брифинг изменился. Обновите страницу.",
        );
      await tx
        .update(briefingTurns)
        .set({ status: "completed", result: payload })
        .where(eq(briefingTurns.id, input.requestId));
    });
    return payload;
  } catch (error) {
    await db.transaction(async (tx) => {
      await tx
        .update(jobBriefs)
        .set({ agentLeaseId: null, agentLeaseUntil: null })
        .where(
          and(
            eq(jobBriefs.id, brief.id),
            eq(jobBriefs.agentLeaseId, input.requestId),
          ),
        );
      await tx
        .update(briefingTurns)
        .set({ status: "failed" })
        .where(
          and(
            eq(briefingTurns.id, input.requestId),
            eq(briefingTurns.status, "pending"),
          ),
        );
    });
    console.error(
      "briefing-agent",
      error instanceof Error ? error.name : "failure",
    );
    throw new Error(
      "Не удалось получить ответ ИИ. Сообщение сохранено: повторите запрос или продолжите позже.",
    );
  }
}

export async function cancelBriefingTurn(briefId: string, requestId: string) {
  await db.transaction(async (tx) => {
    const [cancelled] = await tx
      .update(briefingTurns)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(briefingTurns.id, requestId),
          eq(briefingTurns.briefId, briefId),
          eq(briefingTurns.status, "pending"),
        ),
      )
      .returning({ id: briefingTurns.id });
    if (cancelled)
      await tx
        .update(jobBriefs)
        .set({ agentLeaseId: null, agentLeaseUntil: null })
        .where(
          and(eq(jobBriefs.id, briefId), eq(jobBriefs.agentLeaseId, requestId)),
        );
  });
}

export async function completeBriefing(
  briefId: string,
  expectedVersion: string,
) {
  const [brief] = await db
    .select()
    .from(jobBriefs)
    .where(eq(jobBriefs.id, briefId))
    .limit(1);
  if (!brief) throw new Error("Брифинг не найден.");
  const intake = readIntake(brief.intake);
  if (briefAnswersSchema.parse(brief.answers).length < 1)
    throw new Error("Сначала опишите требования к сотруднику.");
  const updatedAt = new Date(
    Math.max(Date.now(), brief.updatedAt.getTime() + 1),
  );
  await db.transaction(async (tx) => {
    const [saved] = await tx
      .update(jobBriefs)
      .set({ intake: { ...intake, completed: true }, updatedAt })
      .where(
        and(
          eq(jobBriefs.id, briefId),
          versionMatch(expectedVersion),
          leaseFree(),
        ),
      )
      .returning({ id: jobBriefs.id });
    if (!saved)
      throw new Error(
        "Брифинг изменился или ещё обрабатывается. Обновите страницу.",
      );
    await tx
      .update(briefingInvitations)
      .set({ completedAt: updatedAt })
      .where(
        and(
          eq(briefingInvitations.briefId, briefId),
          isNull(briefingInvitations.revokedAt),
        ),
      );
  });
  return { updatedAt: updatedAt.toISOString() };
}
