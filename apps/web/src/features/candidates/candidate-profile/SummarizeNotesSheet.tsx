"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import { AiButton } from "@/components/ui/AiButton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { DrawerLayout } from "@/features/candidates/DrawerLayout";
import { createCandidateNote } from "@/features/candidates/actions";
import { summarizeInterviewNotesAction } from "@/features/interviews/actions";
import {
  interviewTypeLabel,
  type CandidateInterviewItem,
} from "@/features/interviews/shared";
import type { InterviewNotesSummary } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";

/** Mirrors AiScoreCard so a suggested decision reads the same everywhere. */
const DECISION_META: Record<
  "strong_yes" | "yes" | "maybe" | "no",
  { label: string; className: string }
> = {
  strong_yes: { label: "Сильный да", className: "bg-primary/10 text-primary" },
  yes: { label: "Да", className: "bg-primary/10 text-primary" },
  maybe: { label: "Может быть", className: "bg-clay/15 text-clay" },
  no: { label: "Нет", className: "bg-destructive/10 text-destructive" },
};

export function SummarizeNotesSheet({
  interview,
  candidateId,
  workspaceId,
  trigger,
}: {
  interview: CandidateInterviewItem;
  candidateId: string;
  workspaceId: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [rawNotes, setRawNotes] = useState("");
  const [summary, setSummary] = useState<InterviewNotesSummary | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  function summarize() {
    if (!rawNotes.trim()) {
      toast.error("Сначала введите несколько примечаний.");
      return;
    }
    startTransition(async () => {
      const result = await summarizeInterviewNotesAction({
        interviewId: interview.id,
        rawNotes,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSummary(result.summary);
    });
  }

  function saveAsNote() {
    if (!summary) return;
    const decision = DECISION_META[summary.suggestedDecision];
    const body = [
      `Итог интервью, ${interview.title ?? interviewTypeLabel(interview.type)}`,
      "",
      summary.executiveSummary,
      "",
      "Позитивные сигналы",
      ...summary.positiveSignals.map((s) => `• ${s}`),
      ...(summary.concerns.length > 0
        ? ["", "Проблемы", ...summary.concerns.map((c) => `• ${c}`)]
        : []),
      "",
      `Предлагаемое решение: ${decision?.label ?? summary.suggestedDecision}`,
    ].join("\n");

    startSaveTransition(async () => {
      const result = await createCandidateNote({
        candidateId,
        workspaceId,
        body,
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось сохранить заметку.");
        return;
      }
      toast.success("Краткое описание сохранено как заметка.");
      setOpen(false);
      (router as { refresh?: () => void }).refresh?.();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen} mobilePresentation="bottom-on-mobile">
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <DrawerLayout
        title={"Обобщить записи интервью"}
        description={`${interview.title ?? interviewTypeLabel(interview.type)} · ${interview.jobTitle}`}
        footer={
          summary ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isSaving}
              onClick={saveAsNote}
            >
              {isSaving ? "Сохранение…" : "Сохранить как заметку"}
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {!summary ? (
            <>
              <Textarea
                placeholder={"Вставьте сюда свои необработанные записи интервью — беспорядок — это нормально."}
                className="min-h-[180px] resize-y text-sm"
                value={rawNotes}
                onChange={(e) => setRawNotes(e.target.value)}
                disabled={isPending}
              />
              <AiButton
                size="sm"
                onClick={summarize}
                loading={isPending}
                loadingText={"Подведение итогов"}
                disabled={!rawNotes.trim()}
              >
                {"Подведите итоги с помощью ИИ "}</AiButton>
            </>
          ) : (
            <div className="space-y-5 text-sm">
              <div>
                <p className="mb-1.5 font-medium text-foreground">{"Резюме"}</p>
                <p className="leading-relaxed text-muted-foreground">
                  {summary.executiveSummary}
                </p>
              </div>

              {summary.positiveSignals.length > 0 ? (
                <div>
                  <p className="mb-1.5 font-medium text-foreground">
                    {"Позитивные сигналы "}</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {summary.positiveSignals.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {summary.concerns.length > 0 ? (
                <div>
                  <p className="mb-1.5 font-medium text-foreground">{"Проблемы"}</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {summary.concerns.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive/60" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{"Предлагаемое решение"}</p>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    DECISION_META[summary.suggestedDecision]?.className,
                  )}
                >
                  {DECISION_META[summary.suggestedDecision]?.label ??
                    summary.suggestedDecision}
                </span>
              </div>

              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setSummary(null)}
              >
                {"Редактировать заметки и подводить итоги "}</button>
            </div>
          )}
        </div>
      </DrawerLayout>
    </Sheet>
  );
}
