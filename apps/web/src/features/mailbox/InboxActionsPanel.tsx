"use client";

import { localizeSystemText } from "@/lib/localize-system-text";
import { useId, useState, useTransition } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  ProhibitIcon,
  RobotDuotoneIcon,
  SparkleFillIcon,
  TrayIcon,
  UserPlusIcon,
} from "@/components/ui/icons/phosphor";
import type { InboxApplication, InboxCandidate, InboxMember, InboxThread } from "@/features/mailbox/data";

type AiSummary = { summary: string; lastIntent: string; nextStep: string; openQuestions: string[] };

export function InboxActionsPanel({
  thread,
  members,
  candidates,
  applications,
  isPending,
  onAssign,
  onCandidateChange,
  onApplicationChange,
  onCreateCandidate,
  onArchive,
  onMarkSpam,
  onSummarize,
  onSuggestReply,
}: {
  thread: InboxThread;
  members: InboxMember[];
  candidates: InboxCandidate[];
  applications: InboxApplication[];
  isPending: boolean;
  onAssign: (ownerId: string | null) => Promise<{ ok: boolean; error?: string }>;
  onCandidateChange: (candidateId: string | null) => Promise<{ ok: boolean; error?: string }>;
  onApplicationChange: (applicationId: string | null) => Promise<{ ok: boolean; error?: string }>;
  onCreateCandidate: () => void;
  onArchive: () => void;
  onMarkSpam: () => void;
  onSummarize: () => Promise<{ ok: boolean; summary?: AiSummary; error?: string }>;
  onSuggestReply: () => Promise<{ ok: boolean; draft?: { body: string }; error?: string }>;
}) {
  const idPrefix = useId();
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, startAiTransition] = useTransition();
  const candidateApplications = thread.candidateId
    ? applications.filter((application) => application.candidateId === thread.candidateId)
    : [];

  // Pipeline stage shown under the candidate's email. Terminal statuses win
  // over the stage name; otherwise fall back to the current stage or "Applied".
  const stageLabel = !thread.applicationId
    ? null
    : thread.applicationStatus === "rejected"
      ? "Отказ"
      : thread.applicationStatus === "withdrawn"
        ? "снято"
        : thread.applicationStatus === "hired"
          ? "Нанят"
          : thread.applicationStageName ?? "Отклик";
  const stageVariant: "success" | "danger" | "neutral" | "secondary" =
    stageLabel === "Hired" ? "success" : stageLabel === "Rejected" || stageLabel === "Withdrawn" ? "danger" : "secondary";

  function runAi(
    action: () => Promise<{ ok: boolean; summary?: AiSummary; draft?: { body: string }; error?: string }>,
    onSuccess?: (result: { summary?: AiSummary; draft?: { body: string } }) => void,
  ) {
    setAiError(null);
    startAiTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setAiError(result.error ?? "Действия ИИ не удались.");
        else onSuccess?.(result);
      } catch {
        setAiError("Нам не удалось выполнить это действие ИИ.");
      }
    });
  }

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-y-auto bg-muted/15" aria-label={"Контекст разговора"}>
      <div className="space-y-5 px-5 py-5">
        <section className="rounded-lg border border-border/70 bg-background p-3.5">
          <div className="flex items-start gap-3">
            <UserAvatar name={thread.candidateName ?? thread.participantEmail ?? "Неизвестный отправитель"} src={thread.candidateAvatarUrl} size="md" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{thread.candidateName ?? "Неизвестный отправитель"}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{thread.participantEmail ?? "Нет адреса для ответа"}</p>
              {stageLabel ? <Badge variant={stageVariant} className="mt-2">{stageLabel}</Badge> : null}
            </div>
          </div>
          {thread.candidateId && thread.candidateName ? (
            <Link href={`/dashboard/candidates/${thread.candidateId}`} className="mt-3 block text-xs font-semibold text-foreground underline underline-offset-4 hover:text-primary">
              {"Открыть профиль кандидата "}</Link>
          ) : (
            <Button className="mt-3 w-full justify-start" variant="outline" size="sm" disabled={isPending || thread.source !== "mailbox"} onClick={onCreateCandidate}>
              <UserPlusIcon className="size-4" />
              {"Создать кандидата "}</Button>
          )}
        </section>

        <section className="space-y-4" aria-labelledby={`${idPrefix}-context-heading`}>
          <h3 id={`${idPrefix}-context-heading`} className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{"Маршрутизация"}</h3>

          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-owner`} className="text-[13px] font-medium text-foreground">{"Владелец"}</label>
            <Select value={thread.ownerId ?? "unassigned"} onValueChange={(value) => void onAssign(value === "unassigned" ? null : value)}>
              <SelectTrigger id={`${idPrefix}-owner`} className="w-full bg-background" size="sm"><SelectValue placeholder={"Неназначенный"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">{"Неназначенный"}</SelectItem>
                {members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-4 text-muted-foreground">{"Товарищ по команде, ответственный за ответ на этот разговор."}</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-candidate`} className="text-[13px] font-medium text-foreground">{"Кандидат"}</label>
            <Select value={thread.candidateId ?? "none"} onValueChange={(value) => void onCandidateChange(value === "none" ? null : value)}>
              <SelectTrigger id={`${idPrefix}-candidate`} className="w-full bg-background" size="sm"><SelectValue placeholder={"Ни один кандидат не связан"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{"Ни один кандидат не связан"}</SelectItem>
                {candidates.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-application`} className="text-[13px] font-medium text-foreground">{"Отклик"}</label>
            <Select value={thread.applicationId ?? "none"} disabled={!thread.candidateId} onValueChange={(value) => void onApplicationChange(value === "none" ? null : value)}>
              <SelectTrigger id={`${idPrefix}-application`} className="w-full bg-background" size="sm"><SelectValue placeholder={thread.candidateId ? "Приложение не связано" : "Сначала привяжите кандидата"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{"Приложение не связано"}</SelectItem>
                {candidateApplications.map((application) => <SelectItem key={application.id} value={application.id}>{application.jobTitle}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="border-t border-border/70 pt-4" aria-labelledby={`${idPrefix}-ai-heading`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 id={`${idPrefix}-ai-heading`} className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{"Харли ИИ"}</h3>
            <span className="text-[11px] text-muted-foreground">{"Обзор перед использованием"}</span>
          </div>
          <div className="space-y-2">
            <Button className="w-full justify-start" size="sm" variant="outline" disabled={aiPending} onClick={() => runAi(onSummarize, (result) => setAiSummary(result.summary ?? null))}>
              <SparkleFillIcon className="size-4 text-primary" />
              {aiPending ? "Работаю…" : "Подвести итоги разговора"}
            </Button>
            {thread.transport === "imap" ? (
              <Button className="w-full justify-start" size="sm" variant="outline" disabled={aiPending} onClick={() => runAi(onSuggestReply)}>
                <RobotDuotoneIcon className="size-4" />
                {"Предложить ответ "}</Button>
            ) : null}
          </div>
          {aiError ? <p role="alert" className="mt-2 text-xs leading-5 text-destructive">{localizeSystemText(aiError)}</p> : null}
          {aiSummary ? (
            <div className="mt-3 space-y-2 rounded-lg border border-border/70 bg-background p-3 text-xs leading-5">
              <p><span className="font-semibold">{"Кратко:"}</span> {aiSummary.summary}</p>
              <p><span className="font-semibold">{"Последнее намерение:"}</span> {aiSummary.lastIntent}</p>
              <p><span className="font-semibold">{"Следующий шаг:"}</span> {aiSummary.nextStep}</p>
              {aiSummary.openQuestions.length ? <div><p className="font-semibold">{"Открытые вопросы:"}</p><ul className="mt-1 list-disc space-y-1 pl-4">{aiSummary.openQuestions.map((question) => <li key={question}>{question}</li>)}</ul></div> : null}
            </div>
          ) : null}
        </section>

        {thread.source === "mailbox" ? (
          <section className="border-t border-border/70 pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{"Действия потока"}</h3>
            <div className="mt-2 space-y-1">
              <Button className="w-full justify-start" size="sm" variant="ghost" disabled={isPending} onClick={onArchive}><TrayIcon className="size-4" /> {"Архивная ветка"}</Button>
              <Button className="w-full justify-start text-destructive hover:text-destructive" size="sm" variant="ghost" disabled={isPending} onClick={onMarkSpam}><ProhibitIcon className="size-4" /> {"Отметить как спам"}</Button>
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
