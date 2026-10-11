"use client";

import { localizeSystemText } from "@/lib/localize-system-text";
/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  Download,
  FileArchive,
  FileImage,
  FileText,
  FolderCog,
  Gavel,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { DocxViewer } from "@/features/candidates/DocxViewer";
import { PdfViewer } from "@/features/candidates/PdfViewer";
import {
  assignDocument,
  deleteDocument,
  placeDocumentLegalHold,
  releaseDocumentLegalHold,
  renameDocument,
  saveDocumentSignature,
  sendDocumentForSignature,
  setDocumentCategory,
  setDocumentExpiresAt,
  setDocumentStatus,
  voidDocumentSignature,
} from "./actions";
import { DocumentFieldPlacementDialog } from "./DocumentFieldPlacementDialog";
import {
  AccessDialog,
  StatusPill,
  UploadDialog,
  formatActivityType,
  formatDate,
} from "./DocumentShared";
import {
  DOCUMENT_STATUS_META,
  SIGNATURE_STATUS_META,
  documentTypeLabel,
  formatDocumentSize,
  isPreviewable,
  type DocumentHubData,
  type DocumentListItem,
} from "./shared";

function DocumentPreview({ document }: { document: DocumentListItem }) {
  const url = `/api/documents/${document.id}`;
  if (document.mimeType === "application/pdf")
    return (
      <PdfViewer
        fileUrl={url}
        fileName={document.name}
        className="min-h-[70vh]"
      />
    );
  if (
    document.mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return <DocxViewer fileUrl={url} className="min-h-[70vh]" />;
  if (document.mimeType.startsWith("image/"))
    return (
      <div className="flex min-h-[70vh] items-center justify-center rounded-lg border bg-muted/20 p-4">
        <img
          src={url}
          alt={document.name}
          className="max-h-[70vh] max-w-full rounded-md object-contain"
        />
      </div>
    );
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {"Предварительный просмотр недоступен для этого типа файла. "}</div>
  );
}

function SendForSignatureDialog({
  data,
  document,
  open,
  onOpenChange,
}: {
  data: DocumentHubData;
  document: DocumentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState(`Пожалуйста, подпишите: ${document.name}`);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setEmail("");
    setRecipientName("");
    setSubject(`Пожалуйста, подпишите: ${document.name}`);
    setMessage("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await sendDocumentForSignature({
        documentId: document.id,
        recipientEmail: email,
        recipientName,
        subject,
        message: message.trim() || null,
      });
      if (!result.ok) {
        setError(result.error ?? "Не удалось отправить на подпись.");
        return;
      }
      toast.success("Отправлено на подпись");
      reset();
      onOpenChange(false);
      router.refresh();
    });
  }

  const connected = data.esign.connected && data.esign.hasWebhookSecret;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{"Отправить на подпись"}</DialogTitle>
          <DialogDescription>
            {"DocuSeal отправляет электронное письмо получателю — на любой адрес электронной почты, независимо от того, является ли он кандидатом или нет. Подписанный PDF-файл и журнал аудита автоматически возвращаются в это рабочее пространство. "}</DialogDescription>
        </DialogHeader>
        {!connected ? (
          <div className="space-y-3 py-2">
            <p className="rounded-md border border-warning/30 bg-warning/[0.06] px-3 py-3 text-sm text-warning">
              {"DocuSeal — это"}{" "}
              {data.esign.connected
                ? "подключено, но отсутствует секрет веб-перехватчика"
                : "не подключен"}
              . Finish setup in Settings → Integrations before sending for
              signature.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="signer-email">{"Адрес электронной почты получателя"}</Label>
                <Input
                  id="signer-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="taylor@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signer-name">{"Имя получателя"}</Label>
                <Input
                  id="signer-name"
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder={"Тейлор Окафор"}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signer-subject">{"Тема письма"}</Label>
              <Input
                id="signer-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signer-message">{"Сообщение (необязательно)"}</Label>
              <textarea
                id="signer-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={"Добавьте короткую заметку для подписывающего лица…"}
              />
            </div>
            {error ? (
              <p
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {localizeSystemText(error)}
              </p>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {"Отмена "}</Button>
          <Button
            onClick={submit}
            disabled={
              !connected ||
              isPending ||
              !email.trim() ||
              !recipientName.trim() ||
              !subject.trim()
            }
          >
            <Send className="size-4" />
            {isPending ? "Отправка…" : "Отправить на подпись"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoidSignatureDialog({
  document,
  open,
  onOpenChange,
}: {
  document: DocumentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await voidDocumentSignature({
        documentId: document.id,
        reason,
      });
      if (!result.ok) {
        setError(result.error ?? "Не удалось аннулировать запрос.");
        return;
      }
      toast.success("Запрос на подпись аннулирован");
      setReason("");
      onOpenChange(false);
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{"Аннулировать запрос на подпись"}</DialogTitle>
          <DialogDescription>
            {"Это отменяет запрос на подпись. Получатели больше не смогут его подписать, и исходный документ останется неподписанным. "}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="void-reason">{"Причина"}</Label>
            <textarea
              id="void-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={"Адрес электронной почты получателя указан неверно…"}
            />
          </div>
          {error ? (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {localizeSystemText(error)}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {"Отмена "}</Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={isPending || reason.trim().length < 3}
          >
            {isPending ? "Мочеиспускание…" : "Аннулировать запрос"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LegalHoldDialog({
  document,
  open,
  onOpenChange,
  activeHold,
}: {
  document: DocumentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeHold: DocumentListItem["legalHolds"][number] | null;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [isPending, startTransition] = useTransition();
  const releasing = Boolean(activeHold);

  function submit() {
    startTransition(async () => {
      const result = releasing
        ? await releaseDocumentLegalHold({
            holdId: activeHold!.id,
            releaseReason: reason,
          })
        : await placeDocumentLegalHold({
            documentId: document.id,
            reason,
            reference: reference || null,
          });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить юридическое удержание.");
        return;
      }
      toast.success(releasing ? "Юридическое удержание снято" : "Установлено юридическое приостановление");
      setReason("");
      setReference("");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {releasing ? "Освободите юридическую блокировку" : "Наложить юридическое удержание"}
          </DialogTitle>
          <DialogDescription>
            {releasing
              ? "Запишите, почему это удержание снимается. Другие активные запреты, если таковые имеются, остаются в силе."
              : "Это защищает документ от архивирования до тех пор, пока не будут сняты все активные удержания."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="legal-hold-reason">
              {releasing ? "Причина выпуска" : "Причина"}
            </Label>
            <textarea
              id="legal-hold-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={
                releasing
                  ? "Расследование закрыто…"
                  : "Активное судебное разбирательство, аудит или уведомление о сохранении…"
              }
            />
          </div>
          {!releasing ? (
            <div className="space-y-2">
              <Label htmlFor="legal-hold-reference">{"Ссылка (необязательно)"}</Label>
              <Input
                id="legal-hold-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={"Дело, билет или ссылка на дело"}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {"Отмена "}</Button>
          <Button
            onClick={submit}
            disabled={isPending || reason.trim().length < 3}
          >
            {isPending ? "Сохранение…" : releasing ? "Отпустите удержание" : "Удержание места"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpiresAtField({
  document,
  editable,
}: {
  document: DocumentListItem;
  editable: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(
    document.expiresAt ? document.expiresAt.slice(0, 10) : "",
  );
  const [isPending, startTransition] = useTransition();
  const dirty = value !== (document.expiresAt ? document.expiresAt.slice(0, 10) : "");
  function save() {
    startTransition(async () => {
      const result = await setDocumentExpiresAt({
        documentId: document.id,
        expiresAt: value || null,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить дату.");
        return;
      }
      toast.success(value ? "Дата сохранения" : "Дата очищена");
      router.refresh();
    });
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={value}
        disabled={!editable || isPending}
        onChange={(event) => setValue(event.target.value)}
        className="h-8 w-40"
      />
      {dirty ? (
        <Button size="sm" variant="outline" onClick={save} disabled={isPending}>
          {isPending ? "Сохранение…" : "Сохранить"}
        </Button>
      ) : null}
    </div>
  );
}

export function DocumentDetailView({
  data,
  document,
}: {
  data: DocumentHubData;
  document: DocumentListItem;
}) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [sendSignOpen, setSendSignOpen] = useState(false);
  const [nativeSendOpen, setNativeSendOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [attestOpen, setAttestOpen] = useState(false);
  const [attestNote, setAttestNote] = useState("");
  const [nextName, setNextName] = useState(document.name);
  const [isPending, startTransition] = useTransition();

  const status =
    DOCUMENT_STATUS_META[document.status] ?? DOCUMENT_STATUS_META.active;
  const signature =
    SIGNATURE_STATUS_META[document.signatureStatus] ??
    SIGNATURE_STATUS_META.unsigned;
  const isArchived = document.status === "archived";
  const Icon = document.mimeType.startsWith("image/")
    ? FileImage
    : document.mimeType === "application/pdf" || document.mimeType.includes("word")
      ? FileText
      : FileArchive;
  const activeHolds = document.legalHolds.filter((hold) => !hold.releasedAt);
  const activeHold = activeHolds[0] ?? null;

  // A user can have the org-wide "manage documents" permission yet still be
  // narrowed out of THIS document by an explicit ACL rule — surface that
  // distinction instead of letting mutation actions fail with a vague error.
  const restrictedByAcl = data.canManage && document.currentAccessLevel !== "manage";
  const canManageThis = data.canManage && document.currentAccessLevel === "manage";
  // Terminal-but-retryable states: a declined or expired request should still
  // let the sender try again, not dead-end with no send controls at all.
  const canSendForSignature =
    document.signatureStatus === "unsigned" ||
    document.signatureStatus === "declined" ||
    document.signatureStatus === "expired";

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить документ.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }
  function rename() {
    run(
      () => renameDocument({ documentId: document.id, name: nextName }),
      "Имя обновлено",
    );
    setRenameOpen(false);
  }
  const assignmentFor = (assignmentType: "owner" | "reviewer") =>
    document.assignments.find(
      (assignment) => assignment.assignmentType === assignmentType,
    )?.userId ?? "";
  const submitSignatureStatus = (
    nextStatus: keyof typeof SIGNATURE_STATUS_META,
    attestationNote?: string,
  ) =>
    run(
      () =>
        saveDocumentSignature({
          documentId: document.id,
          status: nextStatus,
          provider: document.signatureProvider,
          envelopeId: document.signatureEnvelopeId,
          url: document.signatureUrl,
          expiresAt: document.expiresAt,
          attestationNote,
        }),
      "Статус подписи обновлен.",
    );
  const saveSignatureStatus = (
    nextStatus: keyof typeof SIGNATURE_STATUS_META,
  ) => {
    if (nextStatus === "signed") {
      setAttestNote("");
      setAttestOpen(true);
      return;
    }
    submitSignatureStatus(nextStatus);
  };
  function confirmAttestation() {
    submitSignatureStatus("signed", attestNote);
    setAttestOpen(false);
  }
  function deleteCurrentDocument() {
    if (
      !data.canDelete ||
      !window.confirm(
        `Удалить «${document.name}» навсегда? Это невозможно отменить.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteDocument({ documentId: document.id });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось удалить документ.");
        return;
      }
      toast.success("Документ удален.");
      router.push("/dashboard/documents");
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-5">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="break-words font-display text-xl font-semibold tracking-tight">
                {document.name}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {documentTypeLabel(document.mimeType)} ·{" "}
                {formatDocumentSize(document.sizeBytes)} · v
                {document.currentVersion}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <StatusPill className={status.className}>{status.label}</StatusPill>
                <StatusPill className={signature.className}>
                  {signature.label}
                </StatusPill>
                {document.category ? (
                  <StatusPill className="bg-muted text-muted-foreground">
                    {document.category.name}
                  </StatusPill>
                ) : null}
              </div>
            </div>
          </div>

          {restrictedByAcl ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-3 py-2.5 text-sm text-warning">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <p>
                {"Правило доступа ограничивает доступ к этому документу определенным людям — здесь у вас есть доступ только для чтения, поэтому действия по управлению недоступны, даже если вы можете управлять документами в целом. "}</p>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border/70 pt-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">{"Ассоциация"}</p>
              <p className="mt-1 font-medium">
                {document.associationLabels.join(" · ") || "Рабочая область"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"Владелец"}</p>
              <div className="mt-1 flex items-center gap-2">
                {document.ownerId ? (
                  <>
                    <UserAvatar
                      name={document.ownerName ?? "Workspace"}
                      src={document.ownerImage}
                      size="sm"
                    />
                    <span className="truncate font-medium">
                      {document.ownerName}
                    </span>
                  </>
                ) : (
                  <span className="font-medium">{"Рабочая область"}</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"Обновлено"}</p>
              <p className="mt-1 font-medium">{formatDate(document.updatedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"Версии"}</p>
              <p className="mt-1 font-medium">{document.versionCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"Контрольная сумма"}</p>
              <p
                className="mt-1 truncate font-mono text-[11px]"
                title={document.checksum}
              >
                {document.checksum.slice(0, 12)}…
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                {"Дата вступления в силу/истечения срока действия "}</p>
              <div className="mt-1">
                <ExpiresAtField
                  document={document}
                  editable={canManageThis && !isArchived}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">{"Предварительный просмотр"}</p>
            <Button
              size="sm"
              variant="outline"
              disabled={!isPreviewable(document.mimeType)}
              onClick={() => setPreviewOpen((current) => !current)}
            >
              <FileText className="size-4" />
              {previewOpen ? "Скрыть предварительный просмотр" : "Показать предварительный просмотр"}
            </Button>
          </div>
          {previewOpen ? (
            <DocumentPreview document={document} />
          ) : (
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              {isPreviewable(document.mimeType)
                ? "Предварительный просмотр скрыт — нажмите «Показать предварительный просмотр», чтобы загрузить его."
                : "Предварительный просмотр недоступен для этого типа файла."}
            </div>
          )}
        </div>

        {document.activity.length > 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
            <p className="mb-3 text-sm font-semibold">{"Недавняя активность"}</p>
            <div className="divide-y divide-border/70">
              {document.activity.map((event) => (
                <div key={event.id} className="py-2.5 text-sm first:pt-0 last:pb-0">
                  <p className="capitalize">{formatActivityType(event.type)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.actorName ?? "Система"} ·{" "}
                    {formatDate(event.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {"Действия "}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/documents/${document.id}?download=1`}>
                <Download className="size-4" />
                {"Скачать "}</a>
            </Button>
            {canManageThis ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isArchived}
                onClick={() => setRenameOpen(true)}
              >
                {"Переименовать "}</Button>
            ) : null}
            {canManageThis ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  run(
                    () =>
                      setDocumentStatus({
                        documentId: document.id,
                        status:
                          document.status === "archived"
                            ? "active"
                            : "archived",
                      }),
                    document.status === "archived"
                      ? "Документ восстановлен"
                      : "Документ в архиве",
                  )
                }
              >
                {document.status === "archived" ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
                {document.status === "archived" ? "Восстановить" : "Архив"}
              </Button>
            ) : null}
            {canManageThis ? (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  isArchived ||
                  isPending ||
                  document.signatureStatus === "signed" ||
                  document.signatureStatus === "pending"
                }
                onClick={() => setVersionOpen(true)}
              >
                {"Новая версия "}</Button>
            ) : null}
            {data.canDelete ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={deleteCurrentDocument}
              >
                <Trash2 className="size-4" />
                {"Удалить "}</Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {"Категория "}</p>
            <FolderCog className="size-4 text-muted-foreground" />
          </div>
          <select
            value={document.category?.id ?? ""}
            disabled={!canManageThis || isArchived}
            onChange={(event) =>
              run(
                () =>
                  setDocumentCategory({
                    documentId: document.id,
                    categoryId: event.target.value || null,
                  }),
                "Категория обновлена",
              )
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{"Нет категории"}</option>
            {data.categories
              .filter((category) => category.active)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {"Задания "}</p>
          {(["owner", "reviewer"] as const).map((assignmentType) => (
            <label key={assignmentType} className="block space-y-1.5">
              <span className="text-sm font-medium">
                {assignmentType === "owner" ? "Ответственный" : "Рецензент"}
              </span>
              <select
                value={assignmentFor(assignmentType)}
                disabled={!canManageThis || isArchived || isPending}
                onChange={(event) =>
                  run(
                    () =>
                      assignDocument({
                        documentId: document.id,
                        userId: event.target.value || null,
                        assignmentType,
                      }),
                    `${assignmentType === "owner" ? "Ответственный" : "Рецензент"} обновлено`,
                  )
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{"Не назначено"}</option>
                {data.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {"Доступ и владение "}</p>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
            <p className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              {document.accessRoles.length + document.accessMembers.length === 0
                ? "Разрешение рабочей области"
                : `${document.accessRoles.length + document.accessMembers.length} явное правило`}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {"Владелец и администраторы рабочей области сохраняют доступ. Правила ACL могут ограничить доступ для всех остальных. "}</p>
          </div>
          {data.canShare ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={isArchived}
              onClick={() => setAccessOpen(true)}
            >
              <Users className="size-4" />
              {"Управление доступом "}</Button>
          ) : null}
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {"Подпись "}</p>
            <LockKeyhole className="size-4 text-muted-foreground" />
          </div>
          <select
            value={document.signatureStatus}
            disabled={!canManageThis || isArchived || isPending}
            onChange={(event) =>
              saveSignatureStatus(
                event.target.value as keyof typeof SIGNATURE_STATUS_META,
              )
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {Object.entries(SIGNATURE_STATUS_META).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="rounded-xl border border-border/70 p-3 text-sm">
            <p className="flex items-center gap-2">
              <LockKeyhole className="size-4 text-muted-foreground" />
              {signature.label}
            </p>
            {document.signatureProvider ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {document.signatureProvider}
              </p>
            ) : null}
            {document.signatureUrl ? (
              <a
                href={document.signatureUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                {"Открыть подачу DocuSeal "}</a>
            ) : null}
            {document.manualSignatureNote ? (
              <div className="mt-2 rounded-md bg-warning/10 p-2 text-xs text-warning">
                <p className="font-medium">{"Ручная аттестация"}</p>
                <p className="mt-0.5 leading-5">
                  {document.manualSignatureNote}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {document.manualSignedByName ?? "Менеджер"} ·{" "}
                  {document.manualSignedAt
                    ? formatDate(document.manualSignedAt)
                    : ""}
                </p>
              </div>
            ) : null}
          </div>
          {canManageThis ? (
            <div className="grid gap-2">
              <Button
                disabled={
                  isArchived ||
                  document.status !== "active" ||
                  document.signatureStatus !== "unsigned" ||
                  document.mimeType !== "application/pdf"
                }
                onClick={() =>
                  router.push(`/dashboard/documents/${document.id}/sign`)
                }
              >
                <LockKeyhole className="size-4" />
                {"Подпишите сейчас "}</Button>
              {document.signatureStatus === "pending" &&
              (document.signatureProvider === "docuseal" || document.signatureProvider === "native") ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isArchived}
                  onClick={() => setVoidOpen(true)}
                >
                  <LockKeyhole className="size-4" />
                  {"Аннулировать запрос "}</Button>
              ) : canSendForSignature ? (
                <div className={data.esign.connected && data.remoteSignEnabled ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
                  {data.remoteSignEnabled ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isArchived}
                      onClick={() => setNativeSendOpen(true)}
                    >
                      <LockKeyhole className="size-4" />
                      {"Родная ссылка "}</Button>
                  ) : (
                    <p className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                      {"Ссылки для удаленной подписи отключены. "}<Link href="/settings/signature" className="font-medium text-foreground underline underline-offset-2">{"Включите их в настройках подписи."}</Link>.
                    </p>
                  )}
                  {data.esign.connected ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isArchived}
                      onClick={() => setSendSignOpen(true)}
                    >
                      <Send className="size-4" />
                      DocuSeal
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Gavel className="size-4" />
              {"Управление "}</p>
            {activeHolds.length > 0 ? (
              <StatusPill className="bg-warning/10 text-warning">
                {activeHolds.length} {"активное удержание "}
              </StatusPill>
            ) : null}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {"Уведомления о сохранении и подписанные доказательства остаются в пределах рабочего пространства и защищены ACL. "}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/documents/${document.id}/evidence`}>
                <Download className="size-4" />
                {"Экспортировать доказательства "}</a>
            </Button>
            {canManageThis ? (
              <Button
                size="sm"
                variant="outline"
                disabled={document.status === "archived" && !activeHold}
                onClick={() => setHoldOpen(true)}
              >
                <Gavel className="size-4" />
                {activeHold ? "Освободите юридическую блокировку" : "Наложить юридическое удержание"}
              </Button>
            ) : null}
          </div>
          {activeHolds.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/[0.04] p-3 text-sm">
              <p className="font-medium text-warning">
                {"Этот документ сохранился. "}</p>
              {activeHolds.map((hold) => (
                <div
                  key={hold.id}
                  className="border-t border-warning/20 pt-2 text-xs leading-5 text-warning/80"
                >
                  <p>{hold.reason}</p>
                  {hold.reference ? (
                    <p className="mt-0.5">{"Основание: "}{hold.reference}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{"Переименовать документ"}</DialogTitle>
            <DialogDescription>{"Это изменяет только метаданные."}</DialogDescription>
          </DialogHeader>
          <Input
            value={nextName}
            onChange={(event) => setNextName(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {"Отмена "}</Button>
            <Button onClick={rename} disabled={!nextName.trim() || isPending}>
              {"Сохранить имя "}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AccessDialog
        data={data}
        document={document}
        open={accessOpen}
        onOpenChange={setAccessOpen}
      />
      <UploadDialog
        data={data}
        open={versionOpen}
        onOpenChange={setVersionOpen}
        replaceDocument={document}
      />
      <SendForSignatureDialog
        data={data}
        document={document}
        open={sendSignOpen}
        onOpenChange={setSendSignOpen}
      />
      <DocumentFieldPlacementDialog
        document={document}
        open={nativeSendOpen}
        onOpenChange={setNativeSendOpen}
      />
      <VoidSignatureDialog
        document={document}
        open={voidOpen}
        onOpenChange={setVoidOpen}
      />
      <LegalHoldDialog
        document={document}
        activeHold={activeHold}
        open={holdOpen}
        onOpenChange={setHoldOpen}
      />
      <Dialog open={attestOpen} onOpenChange={setAttestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{"Запись ручной подписи"}</DialogTitle>
            <DialogDescription>
              {"Опишите, как и когда он был подписан. "}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={attestNote}
            onChange={(event) => setAttestNote(event.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttestOpen(false)}>
              {"Отмена "}</Button>
            <Button
              onClick={confirmAttestation}
              disabled={attestNote.trim().length < 3 || isPending}
            >
              {"Подтвердить подписание "}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
