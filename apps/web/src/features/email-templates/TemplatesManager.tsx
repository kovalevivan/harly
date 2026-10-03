"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "@/lib/notification-island/toast";
import DOMPurify from "dompurify";

import {
  createEmailTemplate,
  deleteEmailTemplate,
  setActiveEmailTemplate,
  updateEmailTemplate,
} from "@/features/email-templates/actions";
import {
  SYSTEM_TEMPLATE_TYPES,
  type EmailTemplateItem,
  type TemplateType,
} from "@/features/email-templates/shared";
import {
  findUnknownVariables,
  interpolateTemplate,
  TEMPLATE_VARIABLES,
} from "@/features/email-templates/interpolate";
import {
  FileTextIcon,
  PlusIcon,
  SearchIcon,
  StarFillIcon,
  StarIcon,
  TrashIcon,
} from "@/components/ui/icons/phosphor";
import { DrawerLayout } from "@/features/candidates/DrawerLayout";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetClose } from "@/components/ui/sheet";
import { RelativeTime } from "@/lib/date-hydration";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  general: "Общий",
  interview_invite: "Собеседование",
  rejection: "Отказ",
  offer: "Предложение",
  screening: "Первичный отбор",
  stage_change: "Смена сцены",
};

const TEMPLATE_TYPE_COLORS: Record<TemplateType, string> = {
  general: "bg-muted text-muted-foreground",
  interview_invite: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  rejection: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  offer: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  screening: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  stage_change: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

/** Types with a matching system auto-email , these can be "activated" to override the default. */
const ACTIVATABLE_TYPES = new Set<TemplateType>(SYSTEM_TEMPLATE_TYPES);
const MANUAL_TEMPLATE_TYPES: TemplateType[] = ["general", "screening"];

function isAutomaticTemplateType(type: TemplateType) {
  return ACTIVATABLE_TYPES.has(type);
}

function templateTypeDescription(type: TemplateType) {
  return isAutomaticTemplateType(type)
    ? "Automatic: review the preview, then activate it to replace Harly's default event email."
    : "Только вручную: используйте его при составлении электронного письма кандидату.";
}

// Groups for the variable pill picker
const VARIABLE_GROUPS = Array.from(
  TEMPLATE_VARIABLES.reduce((map, v) => {
    if (!map.has(v.group)) map.set(v.group, []);
    map.get(v.group)!.push(v);
    return map;
  }, new Map<string, typeof TEMPLATE_VARIABLES[number][]>()),
);

// Starter templates shown when the workspace has no templates yet
const STARTER_TEMPLATES: Array<{
  name: string;
  type: TemplateType;
  subject: string;
  body: string;
}> = [
  {
    name: "Приглашение на собеседование",
    type: "interview_invite",
    subject: "Собеседование: {{job_title}} в {{company_name}}",
    body: "<p>Здравствуйте, {{candidate_first_name}}!</p><p>Приглашаем вас на собеседование на позицию <strong>{{job_title}}</strong> в компании {{company_name}}.</p><p><strong>Дата:</strong> {{interview_date}}<br><strong>Время:</strong> {{interview_time}}<br><strong>Место:</strong> {{interview_location}}</p><p>Пожалуйста, подтвердите, удобно ли вам это время.</p><p>С уважением,<br>{{sender_name}}</p>",
  },
  {
    name: "Отказ по отклику",
    type: "rejection",
    subject: "Ваш отклик на позицию {{job_title}}",
    body: "<p>Здравствуйте, {{candidate_first_name}}!</p><p>Спасибо за интерес к позиции <strong>{{job_title}}</strong> в компании {{company_name}} и за ваш отклик.</p><p>После рассмотрения откликов мы решили продолжить общение с кандидатами, чей опыт ближе к текущим требованиям.</p><p>Мы сохраним ваш профиль для будущих вакансий.</p><p>Желаем успехов,<br>{{sender_name}}</p>",
  },
  {
    name: "Предложение о работе",
    type: "offer",
    subject: "Предложение: {{job_title}} в {{company_name}}",
    body: "<p>Здравствуйте, {{candidate_first_name}}!</p><p>Рады предложить вам позицию <strong>{{job_title}}</strong> в компании {{company_name}}.</p><p><strong>Оплата:</strong> {{offer_salary}}<br><strong>Предложение действует до:</strong> {{offer_expiry}}</p><p>Изучите приложенное предложение и напишите нам, если возникнут вопросы.</p><p>Будем рады видеть вас в команде,<br>{{sender_name}}</p>",
  },
  {
    name: "Первичный звонок",
    type: "screening",
    subject: "Знакомство: {{job_title}}",
    body: "<p>Здравствуйте, {{candidate_first_name}}!</p><p>Мы рассмотрели ваш отклик на позицию <strong>{{job_title}}</strong> в компании {{company_name}}.</p><p>Предлагаем созвониться на 30 минут, чтобы познакомиться и рассказать о вакансии.</p><p>До встречи,<br>{{sender_name}}</p>",
  },
  {
    name: "Изменение этапа",
    type: "stage_change",
    subject: "Новый этап: {{stage_name}} · {{job_title}}",
    body: "<p>Здравствуйте, {{candidate_first_name}}!</p><p>Ваш отклик на позицию <strong>{{job_title}}</strong> в компании {{company_name}} перешёл на этап <strong>{{stage_name}}</strong>.</p><p>Мы скоро свяжемся с вами и расскажем о следующих шагах.</p><p>С уважением,<br>{{sender_name}}</p>",
  },
];

const PREVIEW_VALUES = {
  candidate_first_name: "Ава",
  candidate_last_name: "Томпсон",
  candidate_full_name: "Ава Томпсон",
  job_title: "Старший фронтенд-инженер",
  stage_name: "Техническое интервью",
  interview_date: "Вторник, 8 июля",
  interview_time: "10:00 AM PST",
  interview_location: "https://meet.google.com/abc-xyz",
  offer_salary: "140 000 долларов в год",
  offer_expiry: "12 июля 2026 г.",
  offer_url: "https://jobs.acme.com/portal/applications/offer-123",
  company_name: "Акме Инк.",
  portal_link: "https://jobs.acme.com/portal",
  sender_name: "ты",
};

const EMPTY_DRAFT = {
  name: "",
  type: "general" as TemplateType,
  subject: "",
  body: "",
};

type TemplateDraft = typeof EMPTY_DRAFT;

// ─── TemplatesManager ─────────────────────────────────────────────────────────

export function TemplatesManager({
  templates,
  workspaceName,
}: {
  templates: EmailTemplateItem[];
  workspaceName: string;
}) {
  const previewValues = { ...PREVIEW_VALUES, company_name: workspaceName };
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplateItem | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<TemplateType | "all">("all");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [showStarters, setShowStarters] = useState(false);
  const [editorKey] = useState(0);

  const [name, setName] = useState(EMPTY_DRAFT.name);
  const [type, setType] = useState<TemplateType>(EMPTY_DRAFT.type);
  const [subject, setSubject] = useState(EMPTY_DRAFT.subject);
  const [body, setBody] = useState(EMPTY_DRAFT.body);
  const [initialDraft] = useState<TemplateDraft>(EMPTY_DRAFT);

  // Ref handle exposed by RichTextEditor , lets us insert at cursor
  const editorRef = useRef<{ insertText: (text: string) => void } | null>(null);

  const isDirty =
    name.trim() !== initialDraft.name ||
    type !== initialDraft.type ||
    subject.trim() !== initialDraft.subject ||
    body !== initialDraft.body;

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || t.type === filterType;
    return matchesSearch && matchesType;
  });

  const unknownVariables = findUnknownVariables(`${subject}\n${body}`);

  function openNew(prefill?: typeof STARTER_TEMPLATES[number]) {
    void prefill;
    router.push("/dashboard/templates/new" as Route);
    setShowStarters(false);
  }

  function openEdit(template: EmailTemplateItem) {
    router.push(`/dashboard/templates/${template.id}` as Route);
  }

  function closeEditor() {
    setOpen(false);
    setEditing(null);
  }

  function save() {
    startTransition(async () => {
      const fields = { name, type, subject, body };
      const result = editing
        ? await updateEmailTemplate({ templateId: editing.id, ...fields })
        : await createEmailTemplate(fields);

      if (!result.success) {
        toast.error(result.error ?? "Не удалось сохранить шаблон.");
        return;
      }
      toast.success(editing ? "Шаблон обновлен" : "Шаблон создан");
      closeEditor();
      router.refresh();
    });
  }

  function remove(template: EmailTemplateItem) {
    if (!window.confirm(`Удалить шаблон «${template.name}»?`)) return;
    startTransition(async () => {
      const result = await deleteEmailTemplate({ templateId: template.id });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось удалить шаблон.");
        return;
      }
      toast.success("Шаблон удален.");
      router.refresh();
    });
  }

  function toggleActive(template: EmailTemplateItem) {
    startTransition(async () => {
      const result = await setActiveEmailTemplate({
        templateId: template.id,
        active: !template.isActive,
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось обновить шаблон.");
        return;
      }
      toast.success(
        template.isActive
          ? "Возврат к электронной почте по умолчанию"
          : `Теперь используется для каждого электронного письма ${TEMPLATE_TYPE_LABELS[template.type].toLowerCase()}.`,
      );
      router.refresh();
    });
  }

  // Strip HTML tags for plain-text preview of body in cards
  function stripHtml(html: string) {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {templates.length === 0
            ? "Шаблонов пока нет."
            : `Шаблонов: ${templates.length}.`}
        </p>
        <div className="flex items-center gap-2">
          {templates.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => setShowStarters((visible) => !visible)}>
              {showStarters ? "Скрыть стартеры" : "Используйте стартер"}
            </Button>
          ) : null}
          <Button size="sm" onClick={() => openNew()}>
            <PlusIcon className="size-4" />
            {"Новый шаблон "}</Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {"Автоматические шаблоны могут заменить электронные письма о мероприятиях Harly при активации. Просмотрите предварительный просмотр перед активацией; общие шаблоны и шаблоны скрининга предназначены для ручного охвата. "}</p>

      {/* Search + type filter */}
      {templates.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={"Поиск шаблонов…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as TemplateType | "all")}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder={"Все типы"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{"Все типы"}</SelectItem>
              {(Object.keys(TEMPLATE_TYPE_LABELS) as TemplateType[]).map((t) => (
                <SelectItem key={t} value={t}>{TEMPLATE_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {templates.length > 0 && showStarters ? (
        <div className="rounded-xl border border-dashed p-4">
          <div className="mb-3">
            <p className="text-sm font-medium">{"Начните с шаблона"}</p>
            <p className="text-xs text-muted-foreground">{"Выберите отправную точку, а затем настройте ее для своего рабочего пространства."}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {STARTER_TEMPLATES.map((starter) => (
              <button
                key={starter.name}
                type="button"
                onClick={() => openNew(starter)}
                className="group rounded-lg border border-dashed p-3 text-left transition hover:border-primary/40 hover:bg-accent/50"
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", TEMPLATE_TYPE_COLORS[starter.type])}>
                    {TEMPLATE_TYPE_LABELS[starter.type]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {isAutomaticTemplateType(starter.type) ? "Автоматический" : "Только вручную"}
                  </span>
                </div>
                <p className="text-sm font-medium group-hover:text-primary">{starter.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{starter.subject}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Empty state */}
      {templates.length === 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <FileTextIcon className="size-5" />
            </span>
            <p className="text-sm font-medium">{"Пишите один раз, отправляйте часто"}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {"Начните с начального шаблона или создайте свой собственный, используя такие переменные, как"}{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{{candidate_first_name}}"}</code>.
            </p>
          </div>
          {/* Starter template cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {STARTER_TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => openNew(t)}
                className="group rounded-xl border border-dashed p-4 text-left transition hover:border-primary/40 hover:bg-accent/50"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", TEMPLATE_TYPE_COLORS[t.type])}>
                    {TEMPLATE_TYPE_LABELS[t.type]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {isAutomaticTemplateType(t.type) ? "Автоматический" : "Только вручную"}
                  </span>
                </div>
                <p className="text-sm font-medium group-hover:text-primary">{t.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.subject}</p>
              </button>
            ))}
          </div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          variant="filtered"
          icon={FileTextIcon}
          title={"Нет шаблонов, соответствующих этим фильтрам."}
          hint={"Попробуйте другой этап или категорию или выполните поиск по названию шаблона."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className={cn(template.isActive && "border-primary/40")}>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate font-semibold">{template.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("w-fit rounded-md px-2 py-0.5 text-[11px] font-semibold", TEMPLATE_TYPE_COLORS[template.type])}>
                        {TEMPLATE_TYPE_LABELS[template.type]}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {isAutomaticTemplateType(template.type) ? "Автоматический" : "Только вручную"}
                      </span>
                      {template.isActive ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                          <StarFillIcon className="size-2.5" />
                          {"Активные "}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {ACTIVATABLE_TYPES.has(template.type) ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn("size-8", template.isActive ? "text-success" : "text-muted-foreground")}
                        aria-label={
                          template.isActive
                            ? `Прекратите использовать «${template.name}» для автоматических писем.`
                            : `Используйте «${template.name}» для каждого электронного письма ${TEMPLATE_TYPE_LABELS[template.type].toLowerCase()}.`
                        }
                        title={
                          template.isActive
                            ? "Активный. Используется для автоматических писем этой рабочей области."
                            : "Использовать для этой рабочей области автоматические электронные письма"
                        }
                        disabled={isPending}
                        onClick={() => toggleActive(template)}
                      >
                        {template.isActive ? (
                          <StarFillIcon className="size-4" />
                        ) : (
                          <StarIcon className="size-4" />
                        )}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => openEdit(template)}
                    >
                      {"Редактировать "}</Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Удалить ${template.name}`}
                      disabled={isPending}
                      onClick={() => remove(template)}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                </div>
                <p className="truncate text-sm font-medium text-foreground/80">{template.subject}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{stripHtml(template.body)}</p>
                <p className="text-xs text-muted-foreground">
                  {"Обновлено "}<RelativeTime value={template.updatedAt} />
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor sheet */}
      <Sheet
        open={open}
        mobilePresentation="side"
        onOpenChange={(next) => {
          if (!next && isDirty && !window.confirm("Отменить несохраненные изменения?")) return;
          if (!next) closeEditor();
          else setOpen(true);
        }}
      >
        <DrawerLayout
          title={editing ? "Редактировать шаблон" : "Новый шаблон"}
          description={"Переменные заменяются для каждого кандидата при отправке электронного письма."}
          className="inset-0 h-dvh max-h-none w-screen max-w-none rounded-none border-0 sm:max-w-none"
          footer={
            <>
              <SheetClose asChild>
                <Button variant="outline" disabled={isPending}>{"Отмена"}</Button>
              </SheetClose>
              <Button
                onClick={save}
                disabled={isPending || !name.trim() || !subject.trim() || !body.trim()}
              >
                {isPending ? "Сохранение…" : "Сохранить шаблон"}
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            {/* Name + type row */}
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="flex-1 space-y-2">
                <Label htmlFor="template-name">{"Имя"}</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={"Приглашение на собеседование"}
                />
              </div>
              <div className="space-y-2">
                <Label>{"Тип"}</Label>
                <Select value={type} onValueChange={(v) => setType(v as TemplateType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>{"Автоматические электронные письма"}</SelectLabel>
                      {SYSTEM_TEMPLATE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{TEMPLATE_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>{"Ручной охват"}</SelectLabel>
                      {MANUAL_TEMPLATE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{TEMPLATE_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p className="text-xs leading-4 text-muted-foreground">{templateTypeDescription(type)}</p>
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="template-subject">{"Тема"}</Label>
              <Input
                id="template-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Next steps for {{job_title}}"
              />
            </div>

            {/* Body , edit / preview tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{"Тело"}</Label>
                <div className="flex rounded-md border border-border/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setTab("edit")}
                    className={cn(
                      "rounded px-2.5 py-0.5 text-xs font-medium transition",
                      tab === "edit" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {"Редактировать "}</button>
                  <button
                    type="button"
                    onClick={() => setTab("preview")}
                    className={cn(
                      "rounded px-2.5 py-0.5 text-xs font-medium transition",
                      tab === "preview" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {"Предварительный просмотр "}</button>
                </div>
              </div>

              {tab === "edit" ? (
                <>
                  <RichTextEditor
                key={editorKey}
                    defaultValue={body}
                    onChange={setBody}
                    editorRef={editorRef}
                    placeholder={"Hi {{candidate_first_name}},\n\nWrite your message here…"}
                    minHeight="min(56vh,42rem)"
                  />

                  {/* Variable pills grouped */}
                  <div className="space-y-2 pt-1">
                    {VARIABLE_GROUPS.map(([group, vars]) => (
                      <div key={group}>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {vars.map((variable) => (
                            <button
                              key={variable.key}
                              type="button"
                              onClick={() => editorRef.current?.insertText(`{{${variable.key}}}`)}
                              className="cursor-pointer rounded-[6px] bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                              title={variable.label}
                            >
                              {`{{${variable.key}}}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {unknownVariables.length > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {"Неизвестные переменные"}:{" "}
                      {unknownVariables.map((v) => `{{${v}}}`).join(", ")}{", будет отправлено как есть. "}</p>
                  )}
                </>
              ) : (
                /* Preview panel */
                <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-zinc-950">
                  {subject.trim() && (
                    <p className="mb-4 border-b border-border/50 pb-3 text-[13px] font-semibold text-foreground">
                      {interpolateTemplate(subject, previewValues)}
                    </p>
                  )}
                  {body ? (
                    <div
                      className="prose prose-sm max-w-none text-[13px] leading-relaxed text-foreground/90 prose-p:my-2 prose-ul:my-2 prose-ol:my-2"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(
                          interpolateTemplate(body, previewValues),
                          { ALLOWED_TAGS: ["p","br","strong","em","s","ul","ol","li","h1","h2","blockquote","a"], ALLOWED_ATTR: ["href"] },
                        ),
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{"Пока ничего для предварительного просмотра."}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </DrawerLayout>
      </Sheet>
    </div>
  );
}
