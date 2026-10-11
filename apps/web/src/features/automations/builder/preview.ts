import { formatEnumLabel } from "@/lib/format";
/**
 * Natural-language preview of a workflow draft. Pure, client-safe — takes the
 * builder's draft shape (same as `WorkflowDefinitionInput`) and renders a single
 * English sentence: "When X, if Y, then Z." Used in the builder's read-only
 * preview strip and as the subtitle on list cards.
 *
 * No secrets, no PII: config values are summarized, not dumped verbatim. Long
 * text (note/email bodies) is truncated to a preview.
 */

import type { Action, ConditionNode, FieldRef, Operator, Trigger, WorkflowEvent } from "../schema";
import type { WorkflowGraphV2, WorkflowNode } from "../definition/schema-v2";
import { actionMeta, operatorMeta, triggerMeta } from "./catalog";

const BODY_PREVIEW = 60;

function quote(value: string): string {
  return value.length > BODY_PREVIEW ? `"${value.slice(0, BODY_PREVIEW).trim()}…"` : `"${value}"`;
}

function describeValue(value: unknown): string {
  if (value === null || value === undefined) return "ничего";
  if (typeof value === "string") return quote(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "ничего";
    const items = value.map((v) => (typeof v === "string" ? quote(v) : String(v)));
    return items.length === 1 ? items[0]! : `${items.slice(0, -1).join(", ")} или ${items.at(-1)}`;
  }
  return String(value);
}

function describeField(field: FieldRef): string {
  if (field.kind === "literal") return describeValue(field.value);
  return `${field.kind}.${field.path}`;
}

function describeLeaf(
  leaf: Extract<ConditionNode, { type: "leaf" }>,
): string {
  const op = operatorMeta(leaf.op as Operator);
  const lhs = describeField(leaf.field);
  if (!op.wantsValue) {
    // is_set / is_empty read as "X is set" / "X is empty".
    return `${lhs} ${op.label}`;
  }
  return `${lhs} ${op.label} ${describeValue(leaf.value)}`;
}

function describeNode(node: ConditionNode): string {
  switch (node.type) {
    case "leaf":
      return describeLeaf(node);
    case "and":
      if (node.children.length === 0) return "всегда";
      return node.children.map((c, i) => {
        const text = describeNode(c);
        // Wrap sub-groups (and/or/not) in parens so precedence reads.
        return i > 0 && (c.type === "and" || c.type === "or") ? `(${text})` : text;
      }).join(" и ");
    case "or":
      if (node.children.length === 0) return "никогда";
      return node.children.map((c) => {
        const text = describeNode(c);
        return c.type === "and" ? `(${text})` : text;
      }).join(" или ");
    case "not":
      return `не ${describeNode(node.child)}`;
  }
}

/** Render a list of root condition nodes as "if …" text. Empty = "всегда". */
export function describeConditions(roots: ConditionNode[] | undefined): string {
  if (!roots || roots.length === 0) return "всегда";
  if (roots.length === 1) return describeNode(roots[0]!);
  // Multiple roots = implicit AND (conditionsSchema normalizes to array).
  return roots.map((r) => describeNode(r)).join(" и ");
}

/** "When <event>" with the filter, if any, appended. */
export function describeTrigger(trigger: Trigger): string {
  const meta = triggerMeta(trigger.event as WorkflowEvent);
  const lower = meta.label.toLowerCase();
  const base = lower;
  const filter = trigger.filter;
  if (!filter || Object.keys(filter).length === 0) return base;
  const parts = Object.entries(filter).map(([k, v]) => `${k} равно ${describeValue(v)}`);
  return `${base}, где ${parts.join(" и ")}`;
}

/** One-line summary of an action's config, e.g. "move to Phone screen". */
export function describeAction(action: Action): string {
  const meta = actionMeta(action.type);
  if (!meta) return action.type;
  const c = action.config as Record<string, unknown>;
  switch (action.type) {
    case "move_stage":
      return `переместить в ${c.toStageName ?? c.toStageId ?? "этап"}`;
    case "set_status":
      return `изменить статус на ${c.status ? formatEnumLabel(String(c.status)) : "—"}`;
    case "add_note":
      return `добавить заметку ${describeValue(c.body)}`;
    case "add_tag":
      return `добавить тег ${describeValue(c.label)}`;
    case "remove_tag":
      return `удалить тег ${describeValue(c.label)}`;
    case "create_task":
      return `создать задачу${c.title ? ` ${quote(String(c.title))}` : ""}${c.ownerId ? " и назначить её" : ""}`;
    case "send_slack":
      return `отправить сообщение в чат ${describeValue(c.message)}`;
    case "send_email":
      return `отправить письмо ${c.toEmail ? quote(String(c.toEmail)) : "кандидату"} ${c.subject ? `тема: ${quote(String(c.subject))}` : ""}`;
    case "send_booking_link":
      return `отправить ссылку для записи ${c.toEmail ? quote(String(c.toEmail)) : "кандидату"}`;
    case "request_documents": {
      const items = Array.isArray(c.items) ? c.items.length : 0;
      return `запросить документы у кандидата (количество: ${items || "не задано"})`;
    }
    case "generate_document":
      return `создать ${c.title ? quote(String(c.title)) : "документ"}`;
    case "send_document_for_signature":
      return `отправить ${c.documentRequestId ? "загруженный документ" : "документ"} на подпись`;
    case "erase_candidate_data":
      return "запланировать полное удаление данных кандидата";
    case "http_request":
      return `${c.method ?? "POST"} ${c.url ?? "внешний адрес"}`;
    default:
      return meta.label.toLowerCase();
  }
}

/** Full sentence: "When …, if …, then …." */
export function describeWorkflow(input: {
  trigger: Trigger;
  conditions?: ConditionNode[];
  actions: Action[];
}): string {
  const when = describeTrigger(input.trigger);
  const cond = describeConditions(input.conditions);
  const thenPart = input.actions.length === 0
    ? "ничего не делать"
    : input.actions.length === 1
      ? describeAction(input.actions[0]!)
      : `${input.actions.slice(0, -1).map(describeAction).join(", ")} и ${describeAction(input.actions.at(-1)!)}`;

  const ifClause = cond === "всегда" ? "" : ` если ${cond},`;
  return `Когда ${when},${ifClause} то ${thenPart}.`;
}

function graphTrigger(graph: WorkflowGraphV2): Trigger {
  const node = graph.nodes.find(
    (candidate): candidate is Extract<WorkflowNode, { type: "trigger" }> =>
      candidate.type === "trigger" && candidate.id === graph.entryNodeId,
  );
  return node ? { event: node.event, filter: node.filter } : { event: "application.created" };
}

/**
 * Honest summary for v2 list cards. It deliberately describes the graph's
 * shape instead of flattening it through the lossy legacy adapter.
 */
export function describeGraphWorkflow(graph: WorkflowGraphV2): string {
  const trigger = describeTrigger(graphTrigger(graph));
  const counts = graph.nodes.reduce(
    (result, node) => {
      result[node.type] += 1;
      return result;
    },
    { action: 0, condition: 0, delay: 0, approval: 0, wait: 0, end: 0, trigger: 0 },
  );
  const details = [
    counts.action > 0 ? `действий: ${counts.action}` : null,
    counts.condition > 0 ? "ветвление" : null,
    counts.delay > 0 ? "задержка" : null,
    counts.approval > 0 ? "согласование" : null,
    counts.wait > 0 ? "ожидание события" : null,
  ].filter((value): value is string => Boolean(value));
  const plan = details.length > 0 ? details.join(", ") : "нет настроенных шагов";
  return `Когда ${trigger}, то ${plan}.`;
}

export function graphActionCount(graph: WorkflowGraphV2): number {
  return graph.nodes.filter((node) => node.type === "action").length;
}
