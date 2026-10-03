"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { toast } from "@/lib/notification-island/toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEmailTemplate, updateEmailTemplate } from "@/features/email-templates/actions";
import { findUnknownVariables, interpolateTemplate, TEMPLATE_VARIABLES } from "@/features/email-templates/interpolate";
import { SYSTEM_TEMPLATE_TYPES, type EmailTemplateItem, type TemplateType } from "@/features/email-templates/shared";

const LABELS: Record<TemplateType, string> = { general: "Общий", interview_invite: "Собеседование", rejection: "Отказ", offer: "Предложение", screening: "Первичный отбор", stage_change: "Смена сцены" };
const MANUAL: TemplateType[] = ["general", "screening"];
type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
const GROUPS = Array.from(TEMPLATE_VARIABLES.reduce((map, variable) => {
  if (!map.has(variable.group)) map.set(variable.group, []);
  map.get(variable.group)!.push(variable);
  return map;
}, new Map<string, TemplateVariable[]>()));

function normalizeTemplateBody(value: string) {
  if (!value.trim() || /<\/?[a-z][\s\S]*>/i.test(value)) return value;
  return marked.parse(value, { async: false });
}

export function TemplateEditorPage({ template, workspaceName }: { template: EmailTemplateItem | null; workspaceName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(template?.name ?? "");
  const [type, setType] = useState<TemplateType>(template?.type ?? "general");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(() => normalizeTemplateBody(template?.body ?? ""));
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const editorRef = useRef<{ insertText: (text: string) => void } | null>(null);
  const unknown = findUnknownVariables(`${subject}\n${body}`);
  const previewValues = { candidate_first_name: "Ава", candidate_last_name: "Томпсон", candidate_full_name: "Ава Томпсон", job_title: "Старший фронтенд-инженер", stage_name: "Техническое интервью", interview_date: "Вторник, 8 июля", interview_time: "10:00 AM PST", interview_location: "Видеозвонок", offer_salary: "140 000 долларов в год", offer_expiry: "12 июля 2026 г.", offer_url: "#", company_name: workspaceName, portal_link: "#", sender_name: "ты" };

  function save() {
    startTransition(async () => {
      const result = template ? await updateEmailTemplate({ templateId: template.id, name, type, subject, body }) : await createEmailTemplate({ name, type, subject, body });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось сохранить шаблон.");
        return;
      }
      toast.success(template ? "Шаблон обновлен" : "Шаблон создан");
      router.push("/dashboard/templates");
      router.refresh();
    });
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b bg-background">
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
          <Link href="/dashboard/templates" className="w-fit text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">{"← Шаблоны"}</Link>
          <h1 className="text-base font-semibold">{template ? "Редактировать шаблон" : "Новый шаблон"}</h1>
          <div className="flex justify-self-end gap-2">
            <Link href="/dashboard/templates" className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">{"Отмена"}</Link>
            <Button onClick={save} disabled={pending || !name.trim() || !subject.trim() || !body.trim()}>{pending ? "Сохранение…" : "Сохранить шаблон"}</Button>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(30rem,0.8fr)] lg:overflow-hidden">
        <section className="min-w-0 space-y-7 px-4 py-8 sm:px-6 lg:overflow-y-auto lg:px-10 xl:px-14">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="space-y-2"><Label htmlFor="template-name">{"Имя шаблона"}</Label><Input id="template-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={"Приглашение на собеседование"} /></div>
            <div className="space-y-2"><Label>{"Тип"}</Label><Select value={type} onValueChange={(value) => setType(value as TemplateType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectLabel>{"Автоматические электронные письма"}</SelectLabel>{SYSTEM_TEMPLATE_TYPES.map((value) => <SelectItem key={value} value={value}>{LABELS[value]}</SelectItem>)}</SelectGroup><SelectSeparator /><SelectGroup><SelectLabel>{"Ручной охват"}</SelectLabel>{MANUAL.map((value) => <SelectItem key={value} value={value}>{LABELS[value]}</SelectItem>)}</SelectGroup></SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label htmlFor="template-subject">{"Тема"}</Label><Input id="template-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Next steps for {{job_title}}" /></div>
          <div className="space-y-2"><div className="flex items-start justify-between gap-4"><div><Label>{"Сообщение"}</Label><p className="mt-1 text-xs text-muted-foreground">{"Напишите электронное письмо, которое получают кандидаты. При необходимости используйте переменные из справочной панели."}</p></div><div className="flex shrink-0 rounded-lg border border-border/70 bg-muted/40 p-1"><button type="button" onClick={() => setMode("edit")} className={mode === "edit" ? "rounded-md bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm" : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"}>{"Редактировать"}</button><button type="button" onClick={() => setMode("preview")} className={mode === "preview" ? "rounded-md bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm" : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"}>{"Предварительный просмотр"}</button></div></div>{mode === "edit" ? <RichTextEditor key={template?.id ?? "new"} defaultValue={body} onChange={setBody} editorRef={editorRef} placeholder="Hi {{candidate_first_name}}," minHeight="34rem" /> : <div className="min-h-[34rem] rounded-xl border bg-background p-8 sm:p-10"><p className="border-b pb-5 text-lg font-semibold">{interpolateTemplate(subject || "Тема", previewValues)}</p><div className="prose prose-sm mt-6 max-w-none text-sm leading-relaxed dark:prose-invert" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(interpolateTemplate(body || "<p>Start writing your message.</p>", previewValues), { ALLOWED_TAGS: ["p", "br", "strong", "em", "s", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "a"], ALLOWED_ATTR: ["href"] }) }} /></div>}</div>
          {unknown.length > 0 ? <p className="text-xs text-amber-600 dark:text-amber-400">{"Неизвестная переменная"}{unknown.length > 1 ? "s" : ""}: {unknown.map((value) => `{{${value}}}`).join(", ")}. Они будут отправлены без изменений.</p> : null}
        </section>

        <aside className="border-t bg-muted/20 px-4 py-8 sm:px-6 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:px-8 xl:px-10">
          <section><h2 className="text-sm font-semibold">{"Переменные"}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{"Поместите курсор в сообщение, затем выберите переменную, чтобы вставить его."}</p><div className="mt-6 space-y-5">{GROUPS.map(([group, variables]) => <div key={group}><p className="mb-2 text-xs font-medium text-muted-foreground">{group}</p><div className="flex flex-wrap gap-1.5">{variables.map((variable) => <button key={variable.key} type="button" onClick={() => { setMode("edit"); editorRef.current?.insertText(`{{${variable.key}}}`); }} className="rounded-md bg-background px-2.5 py-1.5 text-xs font-medium text-foreground ring-1 ring-border transition hover:bg-accent hover:text-accent-foreground">{`{{${variable.key}}}`}</button>)}</div></div>)}</div></section>
        </aside>
      </main>
    </div>
  );
}
