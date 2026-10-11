import { describe, expect, it } from "vitest";
import { briefTopics, fallbackProfile, type BriefAnswer } from "./model";

describe("job briefing", () => {
  it("keeps all seven answers in the internal profile without inventing details", () => {
    const answers = briefTopics.map((topic, index) => ({
      topic: topic.key,
      question: topic.question,
      answer: `Ответ ${index + 1}`,
    })) as BriefAnswer[];
    const profile = fallbackProfile(answers);
    expect(profile.purpose).toBe("Ответ 1");
    expect(profile.mustHave).toEqual(["Ответ 4"]);
    expect(profile.selection).toEqual(["Ответ 7"]);
  });
});
