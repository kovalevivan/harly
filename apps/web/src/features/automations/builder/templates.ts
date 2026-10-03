/**
 * Starter workflow templates — full `WorkflowDefinitionInput` values a recruiter
 * can spin up in one click from the empty state or the "New from template"
 * picker. Each is a complete WHEN → IF → DO definition, valid against the Zod
 * schemas in `./schema`.
 *
 * Templates are intentionally generic: stage names ("Phone screen", "Offer")
 * and tag labels are placeholders the user edits after creating. They showcase
 * the shape of each construct (trigger, condition tree, action list) without
 * referencing real record ids.
 */

import type { WorkflowDefinitionInput } from "../schema";

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  /** Emoji-free category tag for the gallery. */
  category: "Pipeline" | "Notification" | "Triage" | "Onboarding";
  build: () => WorkflowDefinitionInput;
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "notify-slack-on-apply",
    name: "Уведомить команду о новом отклике",
    description: "Публикуйте сообщение на своем канале Slack/Discord каждый раз, когда кандидат подает заявку.",
    category: "Notification",
    build: () => ({
      name: "Уведомить команду о новом отклике",
      description: "Публикации в канале чата рабочей области, когда кандидат подает заявку.",
      enabled: true,
      trigger: { event: "application.created" },
      conditions: [],
      actions: [
        {
          type: "send_slack",
          config: { message: "New application received for {{job_title}} — {{candidate_full_name}}." },
          continueOnError: true,
        },
      ],
    }),
  },
  {
    id: "auto-reject-juniors",
    name: "Отказать кандидатам, не соответствующим требованиям",
    description: "Когда кандидат подает заявку, если его стаж работы «младший» и рейтинг AI низкий, отклоните его.",
    category: "Triage",
    build: () => ({
      name: "Отказать кандидатам, не соответствующим требованиям",
      description: "Отклоняет кандидатов на младшие должности с низким показателем соответствия ИИ.",
      enabled: false,
      trigger: { event: "application.created" },
      conditions: [
        {
          type: "and",
          children: [
            { type: "leaf", field: { kind: "job", path: "seniority" }, op: "eq", value: "junior" },
            { type: "leaf", field: { kind: "ai", path: "score" }, op: "lt", value: 40 },
          ],
        },
      ],
      actions: [
        {
          type: "set_status",
          config: { status: "rejected" },
          continueOnError: false,
        },
        {
          type: "add_tag",
          config: { label: "auto-rejected" },
          continueOnError: true,
        },
      ],
    }),
  },
  {
    id: "screening-task-on-stage",
    name: "Создать задачу при смене этапа",
    description: "Когда приложение перемещается на «Экран телефона», назначьте владельцу задачу проверки.",
    category: "Pipeline",
    build: () => ({
      name: "Создать задачу при смене этапа",
      description: "Назначает задачу экрана телефона, когда приложение достигает стадии экрана телефона.",
      enabled: true,
      trigger: { event: "application.stage_changed" },
      conditions: [
        { type: "leaf", field: { kind: "trigger", path: "toStageName" }, op: "eq", value: "Phone screen" },
      ],
      actions: [
        {
          type: "create_task",
          config: { title: "Кандидат с экраном телефона", priority: "high" },
          continueOnError: false,
        },
      ],
    }),
  },
  {
    id: "tag-vip-candidates",
    name: "Отметить подходящих кандидатов",
    description: "Если кандидат подает заявку с рейтингом AI выше 80, отметьте его как vip.",
    category: "Triage",
    build: () => ({
      name: "Отметить подходящих кандидатов",
      description: "Помечает сильных кандидатов как «VIP» на основе оценки AI.",
      enabled: true,
      trigger: { event: "application.created" },
      conditions: [
        { type: "leaf", field: { kind: "ai", path: "score" }, op: "gte", value: 80 },
      ],
      actions: [
        {
          type: "add_tag",
          config: { label: "VIP" },
          continueOnError: true,
        },
        {
          type: "send_slack",
          config: { message: "High-fit candidate applied: {{candidate_full_name}} for {{job_title}}." },
          continueOnError: true,
        },
      ],
    }),
  },
  {
    id: "note-on-reject",
    name: "Добавить заметку при отказе",
    description: "Если кандидат отклонен, добавьте внутреннюю заметку для команды.",
    category: "Pipeline",
    build: () => ({
      name: "Добавить заметку при отказе",
      description: "Добавляет примечание с отметкой времени, когда заявка отклонена.",
      enabled: true,
      trigger: { event: "application.rejected" },
      conditions: [],
      actions: [
        {
          type: "add_note",
          config: { body: "Application rejected. Review the stage history for context." },
          continueOnError: true,
        },
      ],
    }),
  },
  {
    id: "interview-prep-task",
    name: "Подготовиться к назначенному собеседованию",
    description: "Когда собеседование назначено, создайте для интервьюера подготовительное задание.",
    category: "Onboarding",
    build: () => ({
      name: "Подготовиться к назначенному собеседованию",
      description: "Создает задачу подготовки к собеседованию, когда собеседование назначено.",
      enabled: true,
      trigger: { event: "interview.scheduled" },
      conditions: [],
      actions: [
        {
          type: "create_task",
          config: { title: "Подготовьтесь к предстоящему собеседованию", priority: "medium" },
          continueOnError: false,
        },
      ],
    }),
  },
  {
    id: "notify-hire",
    name: "Сообщить команде о найме",
    description: "Когда кандидат будет принят на работу, опубликуйте поздравительное сообщение на канале команды.",
    category: "Notification",
    build: () => ({
      name: "Сообщить команде о найме",
      description: "Публикует сообщения в канале команды, когда приложение помечается как принятое на работу.",
      enabled: true,
      trigger: { event: "application.hired" },
      conditions: [],
      actions: [
        {
          type: "send_slack",
          config: { message: "{{candidate_full_name}} accepted — welcome aboard!" },
          continueOnError: true,
        },
      ],
    }),
  },
  {
    id: "tag-new-candidate",
    name: "Отметить источник нового кандидата",
    description: "Когда кандидат будет создан, пометьте его источником для последующей фильтрации.",
    category: "Triage",
    build: () => ({
      name: "Отметить источник нового кандидата",
      description: "Добавляет «новый» тег к каждому только что созданному кандидату.",
      enabled: false,
      trigger: { event: "candidate.created" },
      conditions: [],
      actions: [
        {
          type: "add_tag",
          config: { label: "новых" },
          continueOnError: true,
        },
      ],
    }),
  },
];

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
