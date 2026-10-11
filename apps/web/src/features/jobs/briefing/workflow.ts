import { z } from "zod";
import {
  briefAnswersSchema,
  briefProfileSchema,
  type BriefAnswer,
  type BriefProfile,
} from "./model";
import type { JobDraft } from "@/lib/ai/schemas";

export const criterionSchema = z.object({
  id: z.string().min(1).max(80),
  category: z.enum(["professional", "business", "behavioral"]),
  label: z.string().trim().min(3).max(500),
  required: z.boolean(),
  verification: z.enum(["resume", "interview", "work_sample"]),
  question: z.string().trim().min(3).max(600),
});
export type HiringCriterion = z.infer<typeof criterionSchema>;
export const employeeProfileSchema = briefProfileSchema.extend({
  criteria: z.array(criterionSchema).min(1).max(20),
});
export type EmployeeProfile = z.infer<typeof employeeProfileSchema>;
export const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(12000),
});
export const intakeSchema = z.object({
  messages: z.array(messageSchema).max(80),
  profileApproved: z.boolean(),
  vacancyApproved: z.boolean(),
  caseId: z.string().max(80).nullable(),
  sourceDocuments: z
    .array(z.object({ name: z.string().max(200), text: z.string().max(20000) }))
    .max(5)
    .default([]),
  openQuestions: z.array(z.string().max(600)).max(20).default([]),
  sources: z
    .array(
      z.object({
        topic: z.string(),
        kind: z.enum(["manager", "document", "proposal"]),
        quote: z.string().max(5000),
        messageId: z.string(),
      }),
    )
    .max(100)
    .default([]),
  agentHistory: z.array(z.unknown()).max(600).default([]),
  completed: z.boolean().default(false),
});
export type HiringIntake = z.infer<typeof intakeSchema>;
export const agentTurnSchema = z.object({
  reply: z.string().trim().min(5).max(1500),
  answers: briefAnswersSchema,
});
export const assessmentSchema = z.object({
  id: z.string().max(80),
  status: z.enum(["confirmed", "mismatch", "unverified"]),
  evidence: z.string().max(1000).nullable(),
  explanation: z.string().max(1000),
  question: z.string().max(600),
});
export const resumeAnalysisSchema = z.object({
  summary: z.string().max(1600),
  assessments: z.array(assessmentSchema).max(20),
});
export const resumeReviewSchema = resumeAnalysisSchema.extend({
  id: z.string(),
  candidateName: z.string().max(160),
  candidateId: z.string().nullable(),
  resumeText: z.string().max(20000),
  createdAt: z.string(),
  reference: z.string(),
  criteria: z.array(criterionSchema).max(20),
});
export type ResumeReview = z.infer<typeof resumeReviewSchema>;
export const resumeReviewsSchema = z.array(resumeReviewSchema).max(30);

export const categoryLabels = {
  professional: "Профессиональные",
  business: "Бизнес-результаты",
  behavioral: "Поведение в работе",
};
export const verificationLabels = {
  resume: "Резюме",
  interview: "Интервью",
  work_sample: "Практический кейс",
};
export const statusLabels = {
  confirmed: "Подтверждено",
  mismatch: "Есть расхождение",
  unverified: "Нужно проверить",
};

export function readIntake(value: unknown): HiringIntake {
  const parsed = intakeSchema.safeParse(value);
  return parsed.success
    ? parsed.data
    : {
        messages: [],
        profileApproved: false,
        vacancyApproved: false,
        caseId: null,
        sourceDocuments: [],
        openQuestions: [],
        sources: [],
        agentHistory: [],
        completed: false,
      };
}

export function readEmployeeProfile(value: unknown): EmployeeProfile | null {
  const profile = employeeProfileSchema.safeParse(value);
  if (profile.success) return profile.data;
  const legacy = briefProfileSchema.safeParse(value);
  if (!legacy.success) return null;
  return upgradeProfile(legacy.data);
}

export function upgradeProfile(profile: BriefProfile): EmployeeProfile {
  const requirements = [...profile.mustHave, ...profile.niceToHave];
  return {
    ...profile,
    criteria: [
      ...requirements.map(
        (label, index): HiringCriterion => ({
          id: `skill-${index + 1}`,
          category: "professional",
          label,
          required: index < profile.mustHave.length,
          verification: "resume",
          question: `Приведите конкретный пример: ${label}`,
        }),
      ),
      ...profile.outcomes.map(
        (label, index): HiringCriterion => ({
          id: `result-${index + 1}`,
          category: "business",
          label,
          required: true,
          verification: "interview",
          question: `Как вы достигали похожего результата: ${label}?`,
        }),
      ),
      ...profile.selection.map(
        (label, index): HiringCriterion => ({
          id: `behavior-${index + 1}`,
          category: "behavioral",
          label,
          required: true,
          verification: "work_sample",
          question: `Разберём рабочую ситуацию: ${label}`,
        }),
      ),
    ].slice(0, 20),
  };
}

export function canonicalAnswers(answers: BriefAnswer[]): BriefAnswer[] {
  const topics = new Set<string>();
  return answers.filter((answer) => {
    if (topics.has(answer.topic)) return false;
    topics.add(answer.topic);
    return true;
  });
}

export function reviewReference(
  profile: EmployeeProfile,
  draft: JobDraft,
): string {
  return JSON.stringify({ profile, draft });
}

const normalize = (s: string) =>
  s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

// A model's quote and status cannot become evidence without a matching source.
export function groundAssessments(
  criteria: HiringCriterion[],
  resume: string,
  analysis: z.infer<typeof resumeAnalysisSchema>,
) {
  const source = normalize(resume);
  return criteria.map((criterion) => {
    const found = analysis.assessments.find((item) => item.id === criterion.id);
    const supported =
      found?.evidence &&
      normalize(found.evidence).length >= 8 &&
      source.includes(normalize(found.evidence));
    if (criterion.verification !== "resume" || !supported || !found) {
      return {
        id: criterion.id,
        status: "unverified" as const,
        evidence: null,
        explanation:
          criterion.verification !== "resume"
            ? "Этот критерий проверяется в интервью или практическом кейсе. Резюме не подтверждает поведение в работе."
            : "В резюме нет проверяемого подтверждения или расхождения. Отсутствие сведений не означает отсутствие навыка.",
        question: criterion.question,
      };
    }
    return {
      ...found,
      evidence: found.evidence,
      question: found.question || criterion.question,
    };
  });
}
