"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";
import Link from "next/link";

import { sendCandidateMessage, generateEmailDraftAction } from "@/features/candidates/actions";
import { DrawerLayout } from "@/features/candidates/DrawerLayout";
import {
  interpolateTemplate,
  type TemplateValues,
} from "@/features/email-templates/interpolate";
import { MailComposer, type ComposerTemplate } from "@/features/mailbox/MailComposer";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type EmailTemplateOption = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

type DraftType = "screening" | "interview_invite" | "rejection" | "offer" | "followup";

const DRAFT_TYPES: { id: DraftType; label: string }[] = [
  { id: "screening", label: "Первичный отбор" },
  { id: "interview_invite", label: "Собеседование" },
  { id: "rejection", label: "Отказ" },
  { id: "offer", label: "Предложение" },
  { id: "followup", label: "Follow-up" },
];

export function EmailDrawer({
  candidateId,
  threadId,
  workspaceId,
  email,
  name,
  trigger,
  templates = [],
  templateValues = {},
  aiConfigured = false,
}: {
  candidateId: string;
  threadId?: string | null;
  workspaceId: string;
  email: string;
  name: string;
  trigger: ReactNode;
  templates?: EmailTemplateOption[];
  templateValues?: TemplateValues;
  aiConfigured?: boolean;
}) {
  const router = useRouter();
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const [open, setOpen] = useState(false);
  const [selectedDraftType, setSelectedDraftType] = useState<DraftType>("screening");

  const composerTemplates: ComposerTemplate[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    subject: interpolateTemplate(template.subject, templateValues),
    body: interpolateTemplate(template.body, templateValues),
  }));

  return (
    <Sheet open={open} onOpenChange={setOpen} mobilePresentation="bottom-on-mobile">
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <DrawerLayout
        title={`Электронная почта ${name}`}
        description={"Составьте и отправьте электронное письмо непосредственно этому кандидату."}
      >
        <div className="space-y-4">
          {aiConfigured ? (
            <div className="space-y-2 rounded-xl border bg-muted/30 p-3.5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{"Драфт с ИИ"}</p>
              <p className="text-xs text-muted-foreground">{"Выберите тип, затем используйте «Черновик с ИИ» ниже, чтобы заполнить тему и сообщение."}</p>
              <div className="flex flex-wrap gap-1.5">
                {DRAFT_TYPES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedDraftType(id)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-150 active:scale-[0.96]",
                      selectedDraftType === id
                        ? "border-primary/40 bg-primary text-primary-foreground shadow-sm"
                        : "bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-dashed px-3.5 py-2.5">
              <p className="text-[13px] text-muted-foreground">{"Черновики AI доступны, когда AI настроен."}</p>
              <Link href="/settings/ai" className="text-[13px] font-medium text-primary underline-offset-2 hover:underline">{"Настройка"}</Link>
            </div>
          )}

          <MailComposer
            to={email}
            defaultBody={`<p>Hi ${firstName},</p><p></p>`}
            placeholder={"Напишите свое сообщение…"}
            templates={composerTemplates}
            aiConfigured={aiConfigured}
            sendLabel={"Отправить письмо"}
            onCancel={() => setOpen(false)}
            onDraftAI={async () => {
              const result = await generateEmailDraftAction({ candidateId, threadId, type: selectedDraftType });
              if (!result.ok) {
                if (result.reason === "not_configured") {
                  toast.error(result.error, { action: { label: "Настроить ИИ", onClick: () => router.push("/settings/ai") } });
                } else {
                  toast.error(result.error);
                }
                return null;
              }
              return { subject: result.subject, body: result.body };
            }}
            onSend={async ({ subject, html, text, attachments }) => {
              const result = await sendCandidateMessage({
                candidateId,
                workspaceId,
                threadId,
                toEmail: email,
                subject,
                body: text,
                html,
                attachments: attachments.map((file) => ({ filename: file.filename, contentType: file.contentType, base64: file.base64 })),
              });
              if (!result.success) return { ok: false, error: result.error ?? "Не удалось отправить электронное письмо." };
              toast.success(result.delivered ? "Письмо отправлено" : "Сохранено в треде. Подключите отправителя для доставки.");
              setOpen(false);
              router.refresh();
              return { ok: true };
            }}
          />
        </div>
      </DrawerLayout>
    </Sheet>
  );
}
