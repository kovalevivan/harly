import "server-only";
import { and, eq } from "drizzle-orm";
import { db, jobBriefs } from "@harly/db";
import { briefAnswersSchema } from "./model";
import { readIntake, canonicalAnswers } from "./workflow";
import { versionMatch, leaseFree } from "./service";

export async function saveBriefAnswers(
  briefId: string,
  value: unknown,
  expectedVersion: string,
) {
  const answers = canonicalAnswers(briefAnswersSchema.parse(value));
  const [brief] = await db
    .select()
    .from(jobBriefs)
    .where(eq(jobBriefs.id, briefId))
    .limit(1);
  if (!brief) throw new Error("Брифинг не найден.");
  const intake = readIntake(brief.intake);
  if (intake.completed)
    throw new Error(
      "Брифинг уже передан HR. Создайте новое приглашение для уточнений.",
    );
  const updatedAt = new Date(
    Math.max(Date.now(), brief.updatedAt.getTime() + 1),
  );
  const [saved] = await db
    .update(jobBriefs)
    .set({
      answers,
      intake: {
        ...intake,
        profileApproved: false,
        vacancyApproved: false,
        agentHistory: [],
        sources: [
          ...intake.sources,
          ...answers.map((a) => ({
            topic: a.topic,
            kind: "manager" as const,
            quote: a.answer,
            messageId: "manual-edit",
          })),
        ].slice(-100),
      },
      profile: null,
      generatedDraft: null,
      updatedAt,
    })
    .where(
      and(
        eq(jobBriefs.id, briefId),
        versionMatch(expectedVersion),
        leaseFree(),
      ),
    )
    .returning({ id: jobBriefs.id });
  if (!saved)
    throw new Error("Брифинг изменился или обрабатывается. Обновите сводку.");
  return { updatedAt: updatedAt.toISOString() };
}
