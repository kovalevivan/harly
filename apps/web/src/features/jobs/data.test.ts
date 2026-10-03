import { describe, expect, it } from "vitest";

import {
  formatEmploymentType,
  formatWorkplaceType,
  formatJobStatus,
} from "@/lib/format";

describe("formatEmploymentType", () => {
  it("formats full_time", () => {
    expect(formatEmploymentType("full_time")).toBe("Полная занятость");
  });

  it("formats part_time", () => {
    expect(formatEmploymentType("part_time")).toBe("Частичная занятость");
  });

  it("formats contract", () => {
    expect(formatEmploymentType("contract")).toBe("Договор");
  });

  it("formats internship", () => {
    expect(formatEmploymentType("internship")).toBe("Стажировка");
  });
});

describe("formatWorkplaceType", () => {
  it("formats remote", () => {
    expect(formatWorkplaceType("remote")).toBe("Удалённо");
  });

  it("formats hybrid", () => {
    expect(formatWorkplaceType("hybrid")).toBe("Гибридный формат");
  });

  it("formats onsite", () => {
    expect(formatWorkplaceType("onsite")).toBe("В клинике");
  });
});

describe("formatJobStatus", () => {
  it("formats draft", () => {
    expect(formatJobStatus("draft")).toBe("Черновик");
  });

  it("formats open", () => {
    expect(formatJobStatus("open")).toBe("Открыта");
  });

  it("formats closed", () => {
    expect(formatJobStatus("closed")).toBe("Закрыта");
  });
});
