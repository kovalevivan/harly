import { describe, it, expect } from "vitest";
import { descriptionPrefill, savedVacancyDraft } from "./job-description";
import { callCenterProfile, callCenterDraft } from "./call-center";
import { reviewReference } from "./workflow";

describe("plan description and saved vacancy", () => {
  it("prefills actual rich-text sections and escapes source markup", () => {
    const result = descriptionPrefill({
      id: "plan",
      title: "Оператор",
      updatedAt: new Date("2026-10-11T12:00:00Z"),
      generatedDraft: {
        summary: 'Текст <script> & "кавычки"',
        sections: [
          { title: "Задачи", bullets: ["Звонки < 100", "Запись пациентов"] },
        ],
      },
    });
    expect(result?.description).toBe(
      "<p>Текст &lt;script&gt; &amp; &quot;кавычки&quot;</p>",
    );
    expect(result?.sections[0].body).toBe(
      "<ul><li>Звонки &lt; 100</li><li>Запись пациентов</li></ul>",
    );
    expect(result?.version).toBe("2026-10-11T12:00:00.000Z");
  });
  it("invalidates resume reports after an editor change independently of the plan draft", () => {
    const job = {
      title: "Оператор",
      description: "<p>Звонки</p>",
      contentSections: [{ id: "one", title: "Задачи", body: "<p>Запись</p>" }],
      requirements: null,
      benefits: null,
    };
    const before = reviewReference(callCenterProfile, savedVacancyDraft(job));
    expect(
      reviewReference(
        callCenterProfile,
        savedVacancyDraft({ ...job, description: "<p>Звонки и чаты</p>" }),
      ),
    ).not.toBe(before);
    expect(
      reviewReference(
        callCenterProfile,
        savedVacancyDraft({
          ...job,
          contentSections: [
            { id: "one", title: "Задачи", body: "<p>Запись и CRM</p>" },
          ],
        }),
      ),
    ).not.toBe(before);
    expect(before).not.toBe(
      reviewReference(callCenterProfile, callCenterDraft),
    );
  });
  it("includes legacy requirements and benefits shown by the editor", () => {
    const vacancy = savedVacancyDraft({
      title: "Оператор",
      description: "Звонки",
      contentSections: [],
      requirements: "Грамотная речь",
      benefits: "Обучение",
    });
    expect(vacancy.sections.map((s) => s.bullets[0])).toEqual([
      "Грамотная речь",
      "Обучение",
    ]);
  });
});
