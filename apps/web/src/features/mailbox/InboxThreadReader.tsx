"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Download,
  File,
  FileArchive,
  FileImage,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  CaretLeftIcon,
  CheckIcon,
  DotsThreeVerticalIcon,
  EnvelopeSimpleDuotoneIcon,
  PaperPlaneDuotoneIcon,
} from "@/components/ui/icons/phosphor";
import { RelativeTime } from "@/lib/date-hydration";
import { cn } from "@/lib/utils";
import { MailComposer, type ComposerAttachment } from "@/features/mailbox/MailComposer";
import type { InboxMessage, InboxThread } from "@/features/mailbox/data";

export type ReplyPayload = { body: string; html: string; subject: string; attachments: ComposerAttachment[]; idempotencyKey: string };

function renderAttachmentIcon(contentType: string) {
  const className = "size-4 shrink-0 text-muted-foreground";
  if (contentType.startsWith("image/")) return <FileImage className={className} />;
  if (contentType.includes("pdf") || contentType.includes("text")) return <FileText className={className} />;
  if (contentType.includes("zip") || contentType.includes("archive")) return <FileArchive className={className} />;
  return <File className={className} />;
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentDownload({ attachment }: { attachment: InboxMessage["attachments"][number] }) {
  const [error, setError] = useState(false);

  async function download() {
    setError(false);
    try {
      const response = await fetch(`/api/mailbox/attachments/${attachment.id}`);
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = attachment.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs">
      {renderAttachmentIcon(attachment.contentType)}
      <span className="min-w-0 flex-1 truncate font-medium" title={attachment.filename}>{attachment.filename}</span>
      <span className="shrink-0 text-muted-foreground">{formatSize(attachment.size)}</span>
      <button
        type="button"
        onClick={download}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={`Скачать ${attachment.filename}`}
      >
        <Download className="size-4" />
      </button>
      {error ? <span role="alert" className="text-destructive">{"Недоступно"}</span> : null}
    </div>
  );
}

function snippet(body: string) {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return "Нет содержания сообщения.";
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}

function ThreadMessage({ message, expanded, onToggle, isLast }: { message: InboxMessage; expanded: boolean; onToggle: () => void; isLast: boolean }) {
  const outbound = message.direction === "outbound";
  const recipient = message.toEmails.length ? message.toEmails.join(", ") : "Получатели не указаны";
  const bodyId = `thread-message-${message.id}`;

  return (
    <article className={cn("px-1", !isLast && "border-b border-border/50")}>
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-start gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
        aria-expanded={expanded}
        aria-controls={bodyId}
      >
        <UserAvatar name={message.fromEmail} size="sm" className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-foreground group-hover:text-foreground">
                {message.fromEmail}
              </span>
              {outbound ? <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{"ты"}</span> : null}
            </span>
            <time className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/80" dateTime={message.receivedAt} title={message.receivedAt}>
              <RelativeTime value={message.receivedAt} />
            </time>
          </span>
          {expanded ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{"кому "}{recipient}</span>
          ) : (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground transition-colors group-hover:text-foreground/70">{snippet(message.body)}</span>
          )}
        </span>
      </button>
      {expanded ? (
        <div id={bodyId} className="pb-5 pl-[calc(1.5rem+0.75rem)] pr-2">
          <p className="whitespace-pre-wrap text-[14px] leading-7 text-foreground/90">{message.body || "Текстовое тело не было включено."}</p>
          {message.attachments.length ? (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{"Вложения"}</p>
              {message.attachments.map((attachment) => <AttachmentDownload key={attachment.id} attachment={attachment} />)}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function InboxThreadReader({
  thread,
  messages,
  isPending,
  canReply,
  onBack,
  onMarkRead,
  onSendReply,
  suggestedReply,
  actionsSlot,
  hideSendingNotice = false,
}: {
  thread: InboxThread;
  messages: InboxMessage[];
  isPending: boolean;
  canReply: boolean;
  onBack?: () => void;
  onMarkRead: (thread: InboxThread) => void;
  onSendReply: (payload: ReplyPayload) => Promise<{ ok: boolean; error?: string; sentCopySaved?: boolean }>;
  suggestedReply?: string | null;
  actionsSlot?: React.ReactNode;
  /** Suppress the "Email sending is not connected" nudge (public demo). */
  hideSendingNotice?: boolean;
}) {
  const canSendReply = canReply && Boolean(thread.participantEmail);
  const [composerOpen, setComposerOpen] = useState(canSendReply && Boolean(suggestedReply));
  // Newest first (data arrives descending). Expand the newest by default.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(messages[0] ? [messages[0].id] : []));
  const participantName = thread.candidateName ?? thread.participantEmail ?? "Неизвестный отправитель";
  const replySubject = /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`;

  function toggle(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background duration-200 animate-in fade-in" aria-label={"Разговор"}>
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-3.5">
        <div className="flex min-w-0 items-start gap-3">
          {onBack ? (
            <Button variant="ghost" size="icon-sm" className="-ml-2 mt-0.5 shrink-0" aria-label={"Вернуться к разговорам"} title={"Вернуться к разговорам"} onClick={onBack}>
              <CaretLeftIcon className="size-4" />
            </Button>
          ) : null}
          <UserAvatar name={participantName} src={thread.candidateAvatarUrl} size="md" className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-foreground">{thread.subject}</h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">{participantName}</span>
              {thread.participantEmail ? <span> · {thread.participantEmail}</span> : null}
              <span> · {messages.length} {messages.length === 1 ? "message" : "messages"}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {canSendReply ? (
            <Button size="sm" className="active:scale-[0.97] motion-reduce:active:scale-100" onClick={() => setComposerOpen((open) => !open)} aria-expanded={composerOpen}>
              <PaperPlaneDuotoneIcon className="size-4" />
              {"Ответить "}</Button>
          ) : null}
          {thread.unreadCount ? (
            <Button size="sm" variant="outline" onClick={() => onMarkRead(thread)}>
              <CheckIcon className="size-4" />
              <span className="hidden sm:inline">{"Отметить прочитанным"}</span>
            </Button>
          ) : null}
          {actionsSlot ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={"Действия в диалоге"}>
                  <DotsThreeVerticalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">{actionsSlot}</DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {messages.length ? (
          <div className="w-full">
            {messages.map((message, index) => (
              <ThreadMessage key={message.id} message={message} expanded={expandedIds.has(message.id)} onToggle={() => toggle(message.id)} isLast={index === messages.length - 1} />
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <EnvelopeSimpleDuotoneIcon className="size-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">{"Нет содержания сообщения"}</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{"Этот разговор существует, но поставщик не включил читаемое тело сообщения."}</p>
          </div>
        )}
      </div>

      {!canReply && !hideSendingNotice ? (
        <div className="shrink-0 border-t border-border/70 bg-muted/20 px-5 py-3.5">
          <div className="flex items-start gap-3">
            <EnvelopeSimpleDuotoneIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{"Отправка электронной почты не подключена"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{"В настройках электронной почты настройте отправителя, чтобы он отвечал из папки «Входящие». А пока откройте профиль кандидата для отправки сообщений."}</p>
              {thread.candidateId ? <Link className="mt-2 inline-block text-xs font-semibold text-foreground underline underline-offset-4" href={`/dashboard/candidates/${thread.candidateId}`}>{"Открыть профиль кандидата"}</Link> : null}
            </div>
          </div>
        </div>
      ) : null}

      {canSendReply && thread.participantEmail ? (
        <Sheet open={composerOpen} onOpenChange={setComposerOpen}>
          <SheetContent side="bottom" className="mx-auto max-h-[90vh] w-full overflow-y-auto sm:max-w-2xl sm:rounded-t-xl">
            <SheetHeader>
              <SheetTitle>{"Ответить на "}{participantName}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <MailComposer
                to={thread.participantEmail}
                showSubject={false}
                defaultSubject={replySubject}
                defaultBody={suggestedReply ?? ""}
                placeholder={`Ответить на ${participantName}…`}
                sendLabel="Send reply"
                disabled={isPending}
                onCancel={() => setComposerOpen(false)}
                onSend={async ({ subject, text, html, attachments, idempotencyKey }) => {
                  const result = await onSendReply({ subject, body: text, html, attachments, idempotencyKey });
                  if (result.ok) setComposerOpen(false);
                  return {
                    ok: result.ok,
                    error: result.error,
                    note: result.ok && result.sentCopySaved === false ? "Отправлено, но копию не удалось сохранить в папке Отправленные." : undefined,
                  };
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </section>
  );
}
