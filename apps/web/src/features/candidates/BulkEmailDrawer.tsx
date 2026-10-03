"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import { sendBulkCandidateEmail } from "@/features/candidates/actions";
import type { EmailTemplateOption } from "@/features/candidates/EmailDrawer";
import { TEMPLATE_VARIABLES } from "@/features/email-templates/interpolate";
import { templateHtmlToPlainText } from "@/features/email-templates/plain-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidePanel } from "@/components/ui/side-panel";
import { Textarea } from "@/components/ui/textarea";

/**
 * Bulk email to the selected candidates. Variables stay literal here , the
 * server interpolates them per candidate at send time.
 */
export function BulkEmailDrawer({
  open,
  onOpenChange,
  candidateIds,
  templates,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateIds: string[];
  templates: EmailTemplateOption[];
  onSent: () => void;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isPending, startTransition] = useTransition();

  function applyTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setSubject(template.subject);
    setBody(templateHtmlToPlainText(template.body));
  }

  function send() {
    startTransition(async () => {
      const result = await sendBulkCandidateEmail({
        candidateIds,
        subject,
        body,
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось отправить электронные письма.");
        return;
      }
      toast.success(
        result.failed > 0
          ? `${result.sent} отправлено, ${result.failed} не удалось.`
          : `Электронная почта в очереди для ${result.sent} кандидата.`,
      );
      onOpenChange(false);
      setSubject("");
      setBody("");
      setSelectedTemplateId("");
      onSent();
      router.refresh();
    });
  }

  return (
    <SidePanel
        open={open}
        onOpenChange={onOpenChange}
        title={`Электронная почта ${candidateIds.length} кандидата`}
        description="Переменные вида {{candidate_first_name}} подставляются для каждого кандидата при отправке."
        footer={
          <>
            <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
              {"Отмена "}</Button>
            <Button
              onClick={send}
              disabled={isPending || !subject.trim() || !body.trim()}
            >
              {isPending ? "Отправка…" : "Отправить всем"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {templates.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-medium tracking-tight text-foreground/90">
                  {"Начните с шаблона "}</p>
                {selectedTemplateId ? (
                  <span className="text-xs text-muted-foreground">{"Загружено в это письмо"}</span>
                ) : null}
              </div>
              <Select value={selectedTemplateId || undefined} onValueChange={applyTemplate}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={"Выберите шаблон (необязательно)"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <label
              htmlFor="bulk-subject"
              className="text-[13px] font-medium tracking-tight text-foreground/90"
            >
              {"Тема "}</label>
            <Input
              id="bulk-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Новости по вакансии {{job_title}}"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="bulk-body"
              className="text-[13px] font-medium tracking-tight text-foreground/90"
            >
              {"Сообщение "}</label>
            <Textarea
              id="bulk-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"Здравствуйте, {{candidate_first_name}},\n\n…"}
              className="min-h-44"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {TEMPLATE_VARIABLES.map((variable) => (
                <button
                  key={variable.key}
                  type="button"
                  onClick={() =>
                    setBody((current) =>
                      `${current}${current && !current.endsWith(" ") ? " " : ""}{{${variable.key}}}`,
                    )
                  }
                  className="cursor-pointer rounded-[6px] bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                  title={variable.label}
                >
                  {`{{${variable.key}}}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SidePanel>
  );
}
