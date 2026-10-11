import { describe, expect, it } from "vitest";
import { mockHhGateway } from "./mock";

describe("HeadHunter demo gateway", () => {
  it("offers fictional doctor, sales, and call-centre responses per job", async () => {
    for (const title of ["Врач-стоматолог", "Менеджер по продажам", "Оператор контакт-центра"]) {
      const responses = await mockHhGateway.listResponses({ id: "test-job", title });
      expect(responses).toHaveLength(2);
      expect(responses.every((response) => response.email.endsWith("@example.invalid"))).toBe(true);
      expect(new Set(responses.map((response) => response.externalId)).size).toBe(2);
    }
  });
});
