import { jobDraftSchema, type JobDraft } from "@/lib/ai/schemas";
import { parseJobContentSections } from "../config";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function descriptionPrefill(brief: {
  id: string;
  title: string;
  generatedDraft: unknown;
  updatedAt: Date;
}) {
  const draft = jobDraftSchema.safeParse(brief.generatedDraft);
  if (!draft.success) return undefined;
  return {
    id: brief.id,
    title: brief.title,
    version: brief.updatedAt.toISOString(),
    description: `<p>${escapeHtml(draft.data.summary)}</p>`,
    sections: draft.data.sections.map((section, index) => ({
      id: `brief-${index}`,
      title: section.title,
      body: `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`,
    })),
  };
}

// Use exactly the saved editor content, including legacy sections shown by Harly.
// HTML is source data for the model, never instructions or executable markup.
export function savedVacancyDraft(job: {
  title: string;
  description: string;
  contentSections: unknown;
  requirements: string | null;
  benefits: string | null;
}): JobDraft {
  const sections = parseJobContentSections(job.contentSections);
  if (!sections.length) {
    if (job.requirements)
      sections.push({
        id: "requirements",
        title: "Требования",
        body: job.requirements,
      });
    if (job.benefits)
      sections.push({
        id: "benefits",
        title: "Преимущества",
        body: job.benefits,
      });
  }
  return {
    summary: `${job.title}\n${job.description}`,
    sections: sections.map((section) => ({
      title: section.title,
      bullets: [section.body],
    })),
  };
}
