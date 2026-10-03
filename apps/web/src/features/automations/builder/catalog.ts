/**
 * Builder catalog — client-safe display metadata for the workflow engine's
 * trigger events, condition operators, field kinds, and action types.
 *
 * This is presentation layer only: the source of truth for *what is valid* is
 `./schema` (Zod) and `./registry` (handlers). This module only describes how
 * each value *renders* in the builder — label, blurb, icon, and which config
 * fields an action editor shows.
 *
 * Kept client-safe (no server-only imports) so it can be imported by client
 * components. The action-type list is mirrored from ACTION_REGISTRY; if a type
 * has no handler registered server-side, `available: false` hides it in the
 * picker so a user can never build a workflow that won't run.
 */

import {
  ChatCircleDotsIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  EnvelopeSimpleDuotoneIcon,
  GearSixIcon,
  KeyDuotoneIcon,
  LightningIcon,
  MagicWandDuotoneIcon,
  PaperPlaneDuotoneIcon,
  PencilIcon,
  TrashIcon,
  WebhooksDuotoneIcon,
} from "@/components/ui/icons/phosphor";

import type { ActionType, Operator, WorkflowEvent } from "../schema";

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

export type TriggerMeta = {
  event: WorkflowEvent;
  label: string;
  blurb: string;
  /** lucide-style emoji-free glyph category, mapped to an icon in the picker */
  tone: "apply" | "stage" | "outcome" | "candidate" | "interview" | "job";
};

export const TRIGGER_CATALOG: TriggerMeta[] = [
  {
    event: "application.created",
    label: "Кандидат подает заявку",
    blurb: "На работу подается новая заявка.",
    tone: "apply",
  },
  {
    event: "application.stage_changed",
    label: "Изменения этапов",
    blurb: "Приложение перемещается между этапами конвейера.",
    tone: "stage",
  },
  {
    event: "application.status_changed",
    label: "Изменения статуса",
    blurb: "Статус заявки меняется, например, активно или отозвано.",
    tone: "outcome",
  },
  {
    event: "application.hired",
    label: "Кандидат принят на работу",
    blurb: "Заявка помечается как принятая на работу.",
    tone: "outcome",
  },
  {
    event: "application.rejected",
    label: "Кандидат отклонен",
    blurb: "Заявка отклонена.",
    tone: "outcome",
  },
  {
    event: "candidate.created",
    label: "Кандидат добавлен",
    blurb: "Создается новая запись кандидата.",
    tone: "candidate",
  },
  {
    event: "candidate.updated",
    label: "Кандидат обновлен",
    blurb: "Поля профиля кандидата меняются.",
    tone: "candidate",
  },
  {
    event: "interview.scheduled",
    label: "Интервью запланировано",
    blurb: "С кандидатом назначается собеседование.",
    tone: "interview",
  },
  {
    event: "interview.rescheduled",
    label: "Интервью перенесено",
    blurb: "Время собеседования или детали встречи меняются.",
    tone: "interview",
  },
  {
    event: "interview.completed",
    label: "Интервью завершено",
    blurb: "Интервью отмечено как завершенное.",
    tone: "interview",
  },
  {
    event: "interview.canceled",
    label: "Интервью отменено",
    blurb: "Интервью отменяется.",
    tone: "interview",
  },
  {
    event: "task.completed",
    label: "Задача выполнена",
    blurb: "Задача, связанная с кандидатом или заявкой, выполнена.",
    tone: "outcome",
  },
  {
    event: "job.published",
    label: "Вакансия опубликована",
    blurb: "Вакансия появится на странице карьеры.",
    tone: "job",
  },
  {
    event: "document.signature_sent",
    label: "Документ отправлен на подпись",
    blurb: "Документ отправляется одному или нескольким подписывающим сторонам.",
    tone: "outcome",
  },
  {
    event: "document.signature_changed",
    label: "Изменение статуса подписи",
    blurb: "Подписывающая сторона завершает, отклоняет или иным образом обновляет запрос документа.",
    tone: "outcome",
  },
  {
    event: "document.signature_voided",
    label: "Запрос на подпись аннулирован",
    blurb: "Выполняемый запрос на подпись отменен.",
    tone: "outcome",
  },
  {
    event: "evaluation.completed",
    label: "Оценка ИИ завершена",
    blurb: "Харли завершает оценку заявки кандидата.",
    tone: "outcome",
  },
  {
    event: "webhook.received",
    label: "Вебхук получен",
    blurb: "Внешняя система отправляет аутентифицированное событие в Harly.",
    tone: "job",
  },
];

export function triggerMeta(event: WorkflowEvent): TriggerMeta {
  return TRIGGER_CATALOG.find((t) => t.event === event) ?? {
    event,
    label: event,
    blurb: "",
    tone: "apply",
  };
}

// ---------------------------------------------------------------------------
// Condition operators + field kinds
// ---------------------------------------------------------------------------

export type OperatorMeta = {
  op: Operator;
  label: string;
  /** Whether the right-hand value is collected from the user. */
  wantsValue: boolean;
  /** Hint for the value input type. */
  valueKind?: "text" | "number" | "list";
};

export const OPERATOR_CATALOG: OperatorMeta[] = [
  { op: "eq", label: "равно", wantsValue: true, valueKind: "text" },
  { op: "ne", label: "не равно", wantsValue: true, valueKind: "text" },
  { op: "gt", label: "больше, чем", wantsValue: true, valueKind: "number" },
  { op: "gte", label: "не меньше", wantsValue: true, valueKind: "number" },
  { op: "lt", label: "меньше, чем", wantsValue: true, valueKind: "number" },
  { op: "lte", label: "не больше", wantsValue: true, valueKind: "number" },
  { op: "in", label: "есть ли кто-нибудь из", wantsValue: true, valueKind: "list" },
  { op: "not_in", label: "не является ни одним из", wantsValue: true, valueKind: "list" },
  { op: "includes", label: "включает", wantsValue: true, valueKind: "text" },
  { op: "starts_with", label: "начинается с", wantsValue: true, valueKind: "text" },
  { op: "ends_with", label: "заканчивается", wantsValue: true, valueKind: "text" },
  { op: "contains", label: "содержит", wantsValue: true, valueKind: "text" },
  { op: "is_set", label: "задано", wantsValue: false },
  { op: "is_empty", label: "пусто", wantsValue: false },
  { op: "match_any", label: "соответствует любому из", wantsValue: true, valueKind: "list" },
  { op: "regex", label: "соответствует регулярному выражению", wantsValue: true, valueKind: "text" },
];

/** Operators shown in the recruiter builder. Regex stays in the engine only. */
export const RECRUITER_OPERATORS: Operator[] = OPERATOR_CATALOG
  .filter((entry) => entry.op !== "regex")
  .map((entry) => entry.op);

export function operatorMeta(op: Operator): OperatorMeta {
  return OPERATOR_CATALOG.find((o) => o.op === op) ?? OPERATOR_CATALOG[0]!;
}

export type FieldKindMeta = {
  kind: "candidate" | "application" | "job" | "ai" | "trigger" | "literal";
  label: string;
  blurb: string;
  /** Common paths offered as quick picks in the path input. */
  paths: string[];
};

export const FIELD_KIND_CATALOG: FieldKindMeta[] = [
  {
    kind: "candidate",
    label: "Кандидат",
    blurb: "Поля профиля кандидата.",
    paths: ["firstName", "lastName", "email", "location", "source", "headline"],
  },
  {
    kind: "application",
    label: "Отклик",
    blurb: "Поля в записи приложения.",
    paths: ["status", "stage", "jobId", "source"],
  },
  {
    kind: "job",
    label: "Вакансия",
    blurb: "Поля в задании, для которого предназначена заявка.",
    paths: ["title", "department", "location", "employmentType", "workplaceType", "seniority"],
  },
  {
    kind: "ai",
    label: "Оценка ИИ",
    blurb: "Последняя автоматическая оценка/резюме кандидата.",
    paths: ["score", "recommendation", "summary", "tags"],
  },
  {
    kind: "trigger",
    label: "Данные события",
    blurb: "Необработанное поле из самих полезных данных события.",
    paths: ["jobId", "toStageId", "toStageName", "candidateId", "applicationId", "interview.id"],
  },
  {
    kind: "literal",
    label: "Заданное значение",
    blurb: "Константа для сравнения (нужна редко).",
    paths: [],
  },
];

export function fieldKindMeta(kind: FieldKindMeta["kind"]): FieldKindMeta {
  return FIELD_KIND_CATALOG.find((f) => f.kind === kind) ?? FIELD_KIND_CATALOG[0]!;
}

// ---------------------------------------------------------------------------
// Actions — display + config-field spec
// ---------------------------------------------------------------------------

/**
 * Describes one config field an action editor renders. `key` matches the key
 * in the action's `config` object validated by the registry's Zod schema. The
 * builder writes plain strings into config; the registry parses/coerces.
 */
export type ConfigField =
  | { key: string; label: string; kind: "text"; placeholder?: string; required?: boolean; maxLength?: number }
  | { key: string; label: string; kind: "datetime"; required?: boolean }
  | { key: string; label: string; kind: "textarea"; placeholder?: string; required?: boolean; maxLength?: number }
  | { key: string; label: string; kind: "select"; options: { value: string; label: string }[]; required?: boolean; placeholder?: string }
  | { key: string; label: string; kind: "stage"; required?: boolean }
  | { key: string; label: string; kind: "owner"; }
  | { key: string; label: string; kind: "email-template"; placeholder?: string }
  | { key: string; label: string; kind: "document-template"; placeholder?: string; required?: boolean }
  | { key: string; label: string; kind: "document"; required?: boolean; placeholder?: string; maxLength?: number }
  | { key: string; label: string; kind: "document-attachments"; required?: boolean }
  | { key: string; label: string; kind: "document-request"; required?: boolean; placeholder?: string; maxLength?: number }
  | { key: string; label: string; kind: "interview"; required?: boolean; placeholder?: string; maxLength?: number }
  | { key: string; label: string; kind: "due-offset"; placeholder?: string }
  | { key: string; label: string; kind: "tag"; placeholder?: string; required?: boolean; maxLength?: number }
  | { key: string; label: string; kind: "secret-refs"; placeholder?: string }
  | { key: string; label: string; kind: "keyval"; placeholder?: string }
  | { key: string; label: string; kind: "document-list"; required?: boolean }
  | { key: string; label: string; kind: "recipient-list" };

export type ActionMeta = {
  type: ActionType;
  label: string;
  blurb: string;
  group: "Pipeline" | "Candidate" | "Communication" | "Task" | "Meetings" | "Documents" | "External";
  icon: typeof LightningIcon;
  /** Config fields the editor renders, in order. */
  config: ConfigField[];
  /** Available in the v2 runtime (has a registered handler). False hides from picker. */
  available: boolean;
};

/** Serializable subset of the server tool manifest consumed by the editor. */
export type SafeAutomationToolManifest = {
  type: ActionType;
  version: number;
};

export type PickableActionMeta = ActionMeta & { toolVersion: number };

export const ACTION_CATALOG: ActionMeta[] = [
  {
    type: "move_stage",
    label: "Перейти на сцену",
    blurb: "Переведите приложение на этап конвейера.",
    group: "Pipeline",
    icon: GearSixIcon,
    available: true,
    config: [{ key: "toStageName", label: "Целевой этап", kind: "stage", required: true }],
  },
  {
    type: "set_status",
    label: "Установить статус",
    blurb: "Установите статус заявки (принята на работу, отклонена, …).",
    group: "Pipeline",
    icon: CheckCircleIcon,
    available: true,
    config: [
      {
        key: "status",
        label: "Статус",
        kind: "select",
        required: true,
        options: [
          { value: "active", label: "Активные" },
          { value: "hired", label: "Нанят" },
          { value: "rejected", label: "Отказ" },
          { value: "withdrawn", label: "снято" },
        ],
      },
    ],
  },
  {
    type: "add_note",
    label: "Добавить примечание",
    blurb: "Оставьте заметку о кандидате, авторе рабочего процесса.",
    group: "Candidate",
    icon: PencilIcon,
    available: true,
    config: [{ key: "body", label: "Примечание", kind: "textarea", required: true, maxLength: 2000, placeholder: "Что должно быть сказано в записке?" }],
  },
  {
    type: "add_tag",
    label: "Добавить тег",
    blurb: "Отметьте кандидата.",
    group: "Candidate",
    icon: LightningIcon,
    available: true,
    config: [{ key: "label", label: "Тег", kind: "tag", required: true, maxLength: 50, placeholder: "например VIP" }],
  },
  {
    type: "remove_tag",
    label: "Удалить тег",
    blurb: "Снимите тег с кандидата.",
    group: "Candidate",
    icon: TrashIcon,
    available: true,
    config: [{ key: "label", label: "Тег", kind: "tag", required: true, maxLength: 50, placeholder: "например VIP" }],
  },
  {
    type: "create_task",
    label: "Создать задачу",
    blurb: "Поручите товарищу по команде последующую задачу.",
    group: "Task",
    icon: CheckCircleIcon,
    available: true,
    config: [
      { key: "title", label: "Название задачи", kind: "text", required: true, maxLength: 200, placeholder: "например Проверка телефона кандидата" },
      { key: "description", label: "Подробности задачи", kind: "textarea", maxLength: 2000, placeholder: "Добавить контекст для правопреемника" },
      { key: "ownerId", label: "Правопреемник", kind: "owner" },
      {
        key: "priority",
        label: "Приоритет",
        kind: "select",
        options: [
          { value: "low", label: "Низкий" },
          { value: "medium", label: "Средний" },
          { value: "high", label: "Высокий" },
          { value: "urgent", label: "Срочно" },
        ],
      },
      { key: "dueOffsetDays", label: "Срок сдачи", kind: "due-offset" },
    ],
  },
  {
    type: "send_slack",
    label: "Отправить сообщение в чат",
    blurb: "Опубликуйте сообщение на своем канале Slack/Discord.",
    group: "Communication",
    icon: ChatCircleDotsIcon,
    available: true,
    config: [{ key: "message", label: "Сообщение", kind: "textarea", required: true, maxLength: 2000, placeholder: "New application received for {{job_title}}" }],
  },
  {
    type: "send_email",
    label: "Отправить письмо",
    blurb: "Отправьте кандидату электронное письмо с шаблонным или индивидуальным сообщением.",
    group: "Communication",
    icon: EnvelopeSimpleDuotoneIcon,
    available: true,
    config: [
      { key: "templateId", label: "Шаблон электронного письма", kind: "email-template" },
      { key: "toEmail", label: "Адрес электронной почты получателя", kind: "text", placeholder: "Оставьте пустым для кандидата" },
      { key: "subject", label: "Тема", kind: "text", maxLength: 200, placeholder: "Оставьте поле пустым, чтобы использовать тему шаблона." },
      { key: "body", label: "Тело", kind: "textarea", maxLength: 10000, placeholder: "Оставьте поле пустым, чтобы использовать тело шаблона." },
    ],
  },
  {
    type: "send_booking_link",
    label: "Отправить ссылку на бронирование",
    blurb: "Позвольте кандидату выбрать доступное время для собеседования.",
    group: "Meetings",
    icon: CalendarBlankIcon,
    available: true,
    config: [
      { key: "toEmail", label: "Адрес электронной почты получателя", kind: "text", placeholder: "Оставьте пустым для кандидата" },
      { key: "subject", label: "Тема письма", kind: "text", maxLength: 200, placeholder: "Choose a time to meet with {{company_name}}" },
      { key: "body", label: "Сообщение", kind: "textarea", maxLength: 10000, placeholder: "Pick a time that works for you: {{booking_link}}" },
    ],
  },
  {
    type: "request_documents",
    label: "Запросить документы",
    blurb: "Попросите кандидата загрузить документы на портал.",
    group: "Documents",
    icon: KeyDuotoneIcon,
    available: true,
    config: [
      { key: "items", label: "Документы по запросу", kind: "document-list", required: true },
      { key: "dueAt", label: "Крайний срок кандидата", kind: "datetime" },
    ],
  },
  {
    type: "generate_document",
    label: "Создать документ",
    blurb: "Создайте детерминированный PDF-файл на основе текста и переменных рабочего процесса.",
    group: "Documents",
    icon: KeyDuotoneIcon,
    available: true,
    config: [
      { key: "templateId", label: "Многоразовый шаблон документа", kind: "document-template" },
      { key: "title", label: "Название документа", kind: "text", maxLength: 255, placeholder: "Соглашение о конфиденциальности" },
      { key: "body", label: "Содержание документа", kind: "textarea", maxLength: 50_000, placeholder: "Dear {{candidate_full_name}},\n\nThis document is for {{job_title}} at {{company_name}}." },
      { key: "attachments", label: "PDF-вложения", kind: "document-attachments" },
    ],
  },
  {
    type: "send_document_for_signature",
    label: "Отправить на подпись",
    blurb: "Предложите кандидату подписать PDF-файл на портале Harly.",
    group: "Documents",
    icon: PencilIcon,
    available: true,
    config: [
      { key: "documentId", label: "Существующий документ для подписания", kind: "document" },
      { key: "documentRequestId", label: "Загруженный запрос с предыдущего шага", kind: "document-request" },
      { key: "recipients", label: "Подписание приказа", kind: "recipient-list" },
      { key: "subject", label: "Тема письма", kind: "text", maxLength: 255 },
      { key: "message", label: "Сообщение", kind: "textarea", maxLength: 4000 },
    ],
  },
  {
    type: "schedule_interview",
    label: "Назначить собеседование",
    blurb: "Запишитесь на конфликтно-проверенное собеседование и сообщите об этом кандидату.",
    group: "Meetings",
    icon: MagicWandDuotoneIcon,
    available: true,
    config: [
      { key: "type", label: "Тип интервью", kind: "select", options: [
        { value: "screening", label: "Первичный отбор" },
        { value: "culture_fit", label: "Культура соответствует" },
        { value: "technical", label: "Технический" },
        { value: "onsite", label: "On-site" },
        { value: "final", label: "Финал" },
      ] },
      { key: "mode", label: "Формат", kind: "select", options: [
        { value: "video", label: "Видео" },
        { value: "phone", label: "Телефон" },
        { value: "onsite", label: "On-site" },
      ] },
      { key: "meetingProvider", label: "Организатор встреч", kind: "select", options: [
        { value: "auto", label: "Автоматически выбирать подключенного провайдера" },
        { value: "google_meet", label: "Google Meet (требуется Календарь Google)" },
        { value: "zoom", label: "Зум (требуется подключение к зуму)" },
        { value: "teams", label: "Microsoft Teams (требуется подключение к Outlook)" },
        { value: "jitsi", label: "Jitsi Meet (требуется подключение к Jitsi)" },
        { value: "external", label: "URL внешней встречи" },
      ] },
      { key: "scheduledAt", label: "Начинается в", kind: "datetime", required: true },
      { key: "durationMins", label: "Продолжительность (минуты)", kind: "text", placeholder: "45" },
      { key: "interviewerId", label: "Интервьюер", kind: "owner" },
      { key: "title", label: "Название интервью", kind: "text", maxLength: 120, placeholder: "например Техническое интервью" },
      { key: "location", label: "Расположение/номер", kind: "text", placeholder: "Дополнительная комната или место встречи" },
      { key: "notes", label: "Примечания", kind: "textarea", maxLength: 4000 },
    ],
  },
  {
    type: "reschedule_interview",
    label: "Перенести собеседование",
    blurb: "Переместите существующее интервью и синхронизируйте его поставщиков.",
    group: "Meetings",
    icon: MagicWandDuotoneIcon,
    available: true,
    config: [
      { key: "interviewId", label: "Собеседование", kind: "interview", required: true, placeholder: "Выберите интервью или используйте триггер" },
      { key: "scheduledAt", label: "Новое время начала", kind: "datetime", required: true },
      { key: "durationMins", label: "Продолжительность (минуты)", kind: "text", placeholder: "45" },
      { key: "location", label: "Расположение/номер", kind: "text", placeholder: "Дополнительная комната или место встречи" },
    ],
  },
  {
    type: "cancel_interview",
    label: "Отменить интервью",
    blurb: "Отмените собеседование и очистите подключенных поставщиков услуг встреч.",
    group: "Meetings",
    icon: TrashIcon,
    available: true,
    config: [
      { key: "interviewId", label: "Собеседование", kind: "interview", required: true, placeholder: "Выберите интервью или используйте триггер" },
    ],
  },
  {
    type: "http_request",
    label: "HTTP-запрос",
    blurb: "Call an external URL. Reference secrets as {{secrets.NAME}}.",
    group: "External",
    icon: WebhooksDuotoneIcon,
    available: true,
    config: [
      { key: "url", label: "URL-адрес", kind: "text", required: true, placeholder: "https://api.example.com/hook" },
      {
        key: "method",
        label: "Метод",
        kind: "select",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ value: m, label: m })),
      },
      { key: "headers", label: "Заголовки (по одному на строку, Ключ: Значение)", kind: "keyval", placeholder: "Authorization: Bearer {{secrets.TOKEN}}" },
      { key: "body", label: "Тело", kind: "textarea", placeholder: "{ \"event\": \"{{trigger.event}}\" }" },
      { key: "secretRefs", label: "Упоминаются секретные имена", kind: "secret-refs", placeholder: "TOKEN, API_KEY" },
    ],
  },
  // Additional registered capabilities are kept beside the core catalog so
  // the picker, inspector, NL preview, and run timeline share one vocabulary.
  { type: "send_telegram", label: "Отправить телеграмму", blurb: "Отправьте сообщение в настроенный чат Telegram.", group: "Communication", icon: PaperPlaneDuotoneIcon, available: true, config: [{ key: "message", label: "Сообщение", kind: "textarea", required: true, maxLength: 2000, placeholder: "New candidate received: {{candidate_name}}" }] },
  { type: "send_discord", label: "Отправить Дискорд", blurb: "Опубликуйте сообщение на настроенном канале Discord.", group: "Communication", icon: ChatCircleDotsIcon, available: true, config: [{ key: "message", label: "Сообщение", kind: "textarea", required: true, maxLength: 2000, placeholder: "New candidate received: {{candidate_name}}" }] },
  { type: "send_in_app_alert", label: "Создать оповещение в приложении", blurb: "Уведомите товарища по команде внутри Harly с помощью надежного дедуплицированного оповещения.", group: "Communication", icon: EnvelopeSimpleDuotoneIcon, available: true, config: [
    { key: "recipientUserId", label: "Получатель", kind: "owner" },
    { key: "title", label: "Название оповещения", kind: "text", required: true, maxLength: 160, placeholder: "Рассмотрите этого кандидата" },
    { key: "body", label: "Сообщение", kind: "textarea", maxLength: 2000, placeholder: "Рабочий процесс требует вашего внимания." },
    { key: "href", label: "Харли путь", kind: "text", placeholder: "/dashboard/candidates/..." },
  ] },
  { type: "create_offer", label: "Создать предложение", blurb: "Подготовьте компенсационное предложение для кандидата.", group: "Task", icon: KeyDuotoneIcon, available: true, config: [
    { key: "title", label: "Название предложения", kind: "text", required: true, maxLength: 200, placeholder: "Предложение старшего инженера" },
    { key: "salaryAmount", label: "Сумма зарплаты", kind: "text", placeholder: "120000" },
    { key: "currency", label: "Валюта", kind: "text", placeholder: "доллар США" },
    { key: "salaryPeriod", label: "Зарплатный период", kind: "select", options: [{ value: "annual", label: "Ежегодный" }, { value: "monthly", label: "Ежемесячно" }] },
    { key: "equity", label: "Капитал", kind: "text", placeholder: "например 0,25% варианты" },
    { key: "startDate", label: "Дата начала", kind: "datetime" },
    { key: "expiresAt", label: "Срок действия истекает в", kind: "datetime" },
    { key: "notes", label: "Примечания", kind: "textarea", maxLength: 5000 },
  ] },
  { type: "send_offer", label: "Отправить предложение", blurb: "Поставьте в очередь электронное письмо с предложением или запрос на подпись на портале.", group: "Communication", icon: PaperPlaneDuotoneIcon, available: true, config: [{ key: "offerId", label: "Идентификатор предложения", kind: "text", required: true, placeholder: "Используйте OfferId из раздела «Создать предложение»." }] },
  { type: "ai_score", label: "Оценка ИИ", blurb: "Сгенерируйте оценку соответствия кандидата и согласуйте оценку с помощью ИИ.", group: "Candidate", icon: MagicWandDuotoneIcon, available: true, config: [] },
  { type: "erase_candidate_data", label: "Удалить данные кандидата", blurb: "Удалите кандидата из обычных представлений и поставьте в очередь надежное удаление связанных данных. Требуется разрешение на удаление кандидата.", group: "Candidate", icon: TrashIcon, available: true, config: [] },
  { type: "ai_summarize", label: "AI: summarize", blurb: "Недоступно в средствах автоматизации до тех пор, пока не будет заключен договор о сохранении выходных данных и конфиденциальности.", group: "External", icon: MagicWandDuotoneIcon, available: false, config: [] },
  { type: "ai_decide", label: "ИИ: решение", blurb: "Недоступно: решения о найме требуют явного человеческого решения.", group: "External", icon: MagicWandDuotoneIcon, available: false, config: [] },
];

export function actionMeta(type: ActionType): ActionMeta | undefined {
  return ACTION_CATALOG.find((a) => a.type === type);
}

/** Actions a user is allowed to pick in the builder (registered + available). */
export function pickableActions(
  manifests?: readonly SafeAutomationToolManifest[],
): PickableActionMeta[] {
  const latestVersion = new Map<ActionType, number>();
  for (const manifest of manifests ?? []) {
    const previous = latestVersion.get(manifest.type);
    if (previous === undefined || manifest.version > previous) {
      latestVersion.set(manifest.type, manifest.version);
    }
  }

  return ACTION_CATALOG
    .filter((action) => action.available)
    .filter((action) => !manifests || latestVersion.has(action.type))
    .map((action) => ({
      ...action,
      // Standalone visual tests do not have server data. The live builder
      // always supplies the manifest produced by the versioned registry.
      toolVersion: latestVersion.get(action.type) ?? 1,
    }));
}
