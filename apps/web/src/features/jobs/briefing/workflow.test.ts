import { describe, expect, it } from "vitest";
import { groundAssessments, readIntake, reviewReference } from "./workflow";
import { callCenterProfile, callCenterDraft } from "./call-center";
describe("resume evidence", () => {
  it("requires exact quotes and leaves behavioral claims unverified", () => {
    const analysis = {
      summary: "Пример",
      assessments: [
        {
          id: "experience",
          status: "confirmed" as const,
          evidence: "Два года в колл-центре",
          explanation: "Опыт",
          question: "Даты",
        },
        {
          id: "pc",
          status: "mismatch" as const,
          evidence: "Нет опыта ПК",
          explanation: "Нет",
          question: "Кейс",
        },
        {
          id: "complaint",
          status: "confirmed" as const,
          evidence: "Я стрессоустойчивый",
          explanation: "Да",
          question: "Кейс",
        },
      ],
    };
    const items = groundAssessments(
      callCenterProfile.criteria,
      "Два года в колл-центре. Я стрессоустойчивый.",
      analysis,
    );
    expect(items.find((i) => i.id === "experience")?.status).toBe("confirmed");
    expect(items.find((i) => i.id === "pc")?.status).toBe("unverified");
    expect(items.find((i) => i.id === "complaint")?.status).toBe("unverified");
    expect(items.length).toBe(callCenterProfile.criteria.length);
  });
  it("keeps missing evidence unverified", () => {
    expect(
      groundAssessments(callCenterProfile.criteria, "Краткое резюме", {
        summary: "",
        assessments: [],
      }).every((i) => i.status === "unverified"),
    ).toBe(true);
  });
  it("restores legacy defaults and tracks changed requirements", () => {
    expect(
      readIntake({
        messages: [],
        profileApproved: false,
        vacancyApproved: false,
        caseId: null,
      }).completed,
    ).toBe(false);
    expect(reviewReference(callCenterProfile, callCenterDraft)).not.toBe(
      reviewReference(
        { ...callCenterProfile, purpose: "Новая цель" },
        callCenterDraft,
      ),
    );
  });
});
