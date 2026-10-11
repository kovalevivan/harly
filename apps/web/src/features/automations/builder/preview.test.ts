import { describe, expect, it } from "vitest";

import {
  describeAction,
  describeConditions,
  describeGraphWorkflow,
  describeTrigger,
  describeWorkflow,
  graphActionCount,
} from "./preview";
import type { Action, ConditionNode, Trigger } from "../schema";
import type { WorkflowGraphV2 } from "../definition/schema-v2";

const trigger = (event: Trigger["event"]): Trigger => ({ event });

describe("preview — describeTrigger", () => {
  it("renders the event label lower-cased", () => {
    expect(describeTrigger(trigger("application.created"))).toBe("кандидат подает заявку");
  });

  it("appends the filter when present", () => {
    expect(
      describeTrigger({ event: "application.created", filter: { jobId: "job-1" } }),
    ).toBe('кандидат подает заявку, где jobId равно "job-1"');
  });

  it("ignores an empty filter object", () => {
    expect(describeTrigger({ event: "interview.scheduled", filter: {} })).toBe("интервью запланировано");
  });
});

describe("preview — describeConditions", () => {
  it("returns 'always' for empty / undefined", () => {
    expect(describeConditions(undefined)).toBe("всегда");
    expect(describeConditions([])).toBe("всегда");
  });

  it("renders a single leaf", () => {
    const leaf: ConditionNode = {
      type: "leaf",
      field: { kind: "candidate", path: "firstName" },
      op: "eq",
      value: "Ada",
    };
    expect(describeConditions([leaf])).toBe('candidate.firstName равно "Ada"');
  });

  it("renders an AND group", () => {
    const node: ConditionNode = {
      type: "and",
      children: [
        { type: "leaf", field: { kind: "job", path: "seniority" }, op: "eq", value: "junior" },
        { type: "leaf", field: { kind: "ai", path: "score" }, op: "lt", value: 40 },
      ],
    };
    expect(describeConditions([node])).toBe('job.seniority равно "junior" и ai.score меньше, чем 40');
  });

  it("renders is_set without a value", () => {
    const leaf: ConditionNode = {
      type: "leaf",
      field: { kind: "candidate", path: "email" },
      op: "is_set",
      value: null,
    };
    expect(describeConditions([leaf])).toBe("candidate.email задано");
  });

  it("truncates long values with an ellipsis inside the quotes", () => {
    const long = "x".repeat(120);
    const leaf: ConditionNode = {
      type: "leaf",
      field: { kind: "candidate", path: "headline" },
      op: "contains",
      value: long,
    };
    const out = describeConditions([leaf]);
    expect(out).toContain("…");
    expect(out.length).toBeLessThan(long.length + 40);
  });
});

describe("preview — describeAction", () => {
  it("summarizes move_stage by target", () => {
    const a: Action = { type: "move_stage", config: { toStageName: "Phone screen" }, continueOnError: false };
    expect(describeAction(a)).toBe("переместить в Phone screen");
  });

  it("summarizes set_status", () => {
    const a: Action = { type: "set_status", config: { status: "rejected" }, continueOnError: false };
    expect(describeAction(a)).toBe("изменить статус на Отказ");
  });

  it("summarizes add_tag", () => {
    const a: Action = { type: "add_tag", config: { label: "vip" }, continueOnError: false };
    expect(describeAction(a)).toBe('добавить тег "vip"');
  });

  it("summarizes http_request with method + url", () => {
    const a: Action = { type: "http_request", config: { method: "POST", url: "https://x.dev/h" }, continueOnError: false };
    expect(describeAction(a)).toBe("POST https://x.dev/h");
  });

  it("summarizes a self-scheduling booking link", () => {
    const a: Action = { type: "send_booking_link", config: {}, continueOnError: false };
    expect(describeAction(a)).toBe("отправить ссылку для записи кандидату");
  });

  it("falls back to the catalog label for an unregistered type", () => {
    const a = { type: "ai_decide", config: {}, continueOnError: false } as unknown as Action;
    expect(describeAction(a)).toBe("ии: решение");
  });
});

describe("preview — describeWorkflow (full sentence)", () => {
  it("composes when / if / then", () => {
    const out = describeWorkflow({
      trigger: { event: "application.created" },
      conditions: [
        { type: "leaf", field: { kind: "ai", path: "score" }, op: "gte", value: 80 },
      ],
      actions: [{ type: "add_tag", config: { label: "vip" }, continueOnError: true }],
    });
    expect(out).toBe('Когда кандидат подает заявку, если ai.score не меньше 80, то добавить тег "vip".');
  });

  it("omits the if clause when there are no conditions", () => {
    const out = describeWorkflow({
      trigger: { event: "application.created" },
      conditions: [],
      actions: [{ type: "send_slack", config: { message: "hi" }, continueOnError: true }],
    });
    expect(out).toBe('Когда кандидат подает заявку, то отправить сообщение в чат "hi".');
  });

  it("says 'do nothing' for an empty action list", () => {
    const out = describeWorkflow({
      trigger: { event: "job.published" },
      conditions: [],
      actions: [],
    });
    expect(out).toBe("Когда вакансия опубликована, то ничего не делать.");
  });

  it("joins multiple actions with commas + 'and'", () => {
    const out = describeWorkflow({
      trigger: { event: "application.created" },
      conditions: [],
      actions: [
        { type: "set_status", config: { status: "rejected" }, continueOnError: false },
        { type: "add_tag", config: { label: "auto-rejected" }, continueOnError: true },
      ],
    });
    expect(out).toBe("Когда кандидат подает заявку, то изменить статус на Отказ и добавить тег \"auto-rejected\".");
  });
});

describe("preview — v2 graph summary", () => {
  it("keeps waits, approvals, and branching visible instead of flattening them", () => {
    const graph: WorkflowGraphV2 = {
      schemaVersion: 2,
      entryNodeId: "trigger",
      nodes: [
        { id: "trigger", type: "trigger", event: "application.created" },
        { id: "if", type: "condition", tree: [] },
        { id: "delay", type: "delay", mode: "duration", durationMs: 86_400_000 },
        { id: "approval", type: "approval", eligibleActorIds: [], rule: "any" },
        { id: "wait", type: "wait", kind: "event", eventName: "application.status_changed" },
        { id: "action", type: "action", actionType: "add_tag", toolVersion: 1, failurePolicy: "stop", input: {} },
        { id: "end", type: "end", result: "completed" },
      ],
      edges: [],
    };

    expect(graphActionCount(graph)).toBe(1);
    expect(describeGraphWorkflow(graph)).toBe(
      "Когда кандидат подает заявку, то действий: 1, ветвление, задержка, согласование, ожидание события.",
    );
  });
});
