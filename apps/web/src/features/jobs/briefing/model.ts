import { z } from "zod";

export const briefTopics = [
  { key: "purpose", question: "Зачем открывается эта позиция и какую проблему должен решить новый сотрудник?" },
  { key: "outcomes", question: "Каких конкретных результатов вы ожидаете через 3–6 месяцев?" },
  { key: "responsibilities", question: "Какие ежедневные задачи и зоны ответственности будут у сотрудника?" },
  { key: "mustHave", question: "Какие навыки, опыт или допуски действительно обязательны?" },
  { key: "niceToHave", question: "Что было бы преимуществом, но чему можно научить после найма?" },
  { key: "conditions", question: "Где, по какому графику и на каких условиях человек будет работать?" },
  { key: "selection", question: "Как вы поймёте на интервью, что кандидат подходит?" },
] as const;

export const briefAnswerSchema = z.object({
  topic: z.enum(briefTopics.map((item) => item.key) as [
    (typeof briefTopics)[number]["key"],
    ...(typeof briefTopics)[number]["key"][],
  ]),
  question: z.string().trim().min(3).max(600),
  answer: z.string().trim().min(2).max(5000),
});

export const briefAnswersSchema = z.array(briefAnswerSchema).max(briefTopics.length);
export type BriefAnswer = z.infer<typeof briefAnswerSchema>;

export const briefProfileSchema = z.object({
  purpose: z.string(),
  outcomes: z.array(z.string()),
  responsibilities: z.array(z.string()),
  mustHave: z.array(z.string()),
  niceToHave: z.array(z.string()),
  conditions: z.array(z.string()),
  selection: z.array(z.string()),
});
export type BriefProfile = z.infer<typeof briefProfileSchema>;

export function fallbackProfile(answers: BriefAnswer[]): BriefProfile {
  const find = (key: BriefAnswer["topic"]) =>
    answers.find((item) => item.topic === key)?.answer.trim() ?? "";
  const list = (key: BriefAnswer["topic"]) =>
    find(key).split(/\n|;|•/).map((part) => part.trim()).filter(Boolean);
  return {
    purpose: find("purpose"),
    outcomes: list("outcomes"),
    responsibilities: list("responsibilities"),
    mustHave: list("mustHave"),
    niceToHave: list("niceToHave"),
    conditions: list("conditions"),
    selection: list("selection"),
  };
}

export function profileAsText(profile: BriefProfile): string {
  return [
    `Цель найма: ${profile.purpose}`,
    `Результаты: ${profile.outcomes.join("; ")}`,
    `Задачи: ${profile.responsibilities.join("; ")}`,
    `Обязательные требования: ${profile.mustHave.join("; ")}`,
    `Желательные навыки: ${profile.niceToHave.join("; ")}`,
    `Условия: ${profile.conditions.join("; ")}`,
    `Критерии отбора: ${profile.selection.join("; ")}`,
  ].join("\n");
}
