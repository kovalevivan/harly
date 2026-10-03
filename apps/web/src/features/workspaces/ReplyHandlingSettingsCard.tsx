"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import {
  disableInboundEmailAction,
  saveInboundEmailSettingsAction,
} from "@/features/workspaces/email-settings-actions";
import {
  disableMailboxSettingsAction,
  saveMailboxSettingsAction,
  testMailboxConnectionAction,
} from "@/features/workspaces/mailbox-settings-actions";
import type { WorkspaceInboundEmailStatus } from "@/lib/email/config";
import type { MailboxStatus } from "@/lib/mailbox/config";
import {
  SectionHeader,
  StatCell,
  StatusPill,
} from "@/features/workspaces/settings-ui";
import { DrawerLayout } from "@/features/candidates/DrawerLayout";
import { PostmarkLogo, ResendLogo } from "@/components/ui/icons/brands";
import {
  ArrowsClockwiseIcon,
  CopyIcon,
  KeyDuotoneIcon,
  SpinnerIcon,
  WarningCircleIcon,
} from "@/components/ui/icons/phosphor";
import { EnvelopeIcon } from "@/components/ui/icons/settings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatRelative } from "@/lib/date";

type ReplyMode = "mailbox" | "threaded";
type InboundProviderId = "resend" | "postmark";

const INBOUND_PROVIDER_LABEL: Record<InboundProviderId, string> = {
  resend: "Отправить повторно",
  postmark: "Почтовый штемпель",
};

export function ReplyHandlingSettingsCard({
  mailboxStatus,
  inboundStatus,
  canEdit,
}: {
  mailboxStatus: MailboxStatus;
  inboundStatus: WorkspaceInboundEmailStatus;
  canEdit: boolean;
}) {
  const mailboxConfigured = mailboxStatus.configured;
  const inboundConfigured =
    inboundStatus.hasWebhookSecret && Boolean(inboundStatus.replyDomain);
  const bothEnabled = mailboxStatus.enabled && inboundStatus.enabled;
  const mode: ReplyMode = mailboxStatus.enabled
    ? "mailbox"
    : inboundStatus.enabled
      ? "threaded"
      : mailboxConfigured
        ? "mailbox"
        : "mailbox";
  const configured = mode === "mailbox" ? mailboxConfigured : inboundConfigured;
  const enabled =
    mode === "mailbox" ? mailboxStatus.enabled : inboundStatus.enabled;

  const badge = bothEnabled ? (
    <StatusPill tone="warn">{"Выберите один режим"}</StatusPill>
  ) : configured ? (
    <StatusPill tone={enabled ? "on" : "off"}>
      {enabled ? "Подключено" : "Отключено"}
    </StatusPill>
  ) : (
    <StatusPill tone="neutral">{"Не подключено"}</StatusPill>
  );

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="p-6">
        <SectionHeader
          icon={EnvelopeIcon}
          title={"Обработка ответов"}
          badge={badge}
          description={"Выберите, как ответы кандидатов будут возвращаться в вашу команду: общий почтовый ящик или цепочки ответов через веб-перехватчик."}
          action={
            canEdit ? (
              mailboxStatus.encryptionReady ? (
                <Button asChild variant={configured ? "outline" : "default"}>
                  <Link href={"/settings/email/replies" as Route}>
                    <KeyDuotoneIcon className="size-4" />
                    {configured ? "Управление" : "Подключиться"}
                  </Link>
                </Button>
              ) : (
                <Button variant="default" disabled>
                  <KeyDuotoneIcon className="size-4" />
                  {"Подключиться "}</Button>
              )
            ) : null
          }
        />
      </div>

      {!mailboxStatus.encryptionReady ? (
        <div className="mx-6 mb-6 flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/5 px-3 py-2 text-sm text-clay">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            {"Установить "}<code className="font-mono text-xs">AI_ENCRYPTION_KEY</code> {"на сервере для хранения учетных данных ответа. "}</p>
        </div>
      ) : null}

      {configured || bothEnabled ? (
        <div className="grid grid-cols-1 divide-y border-t bg-muted/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <StatCell label={"Режим"}>
            {bothEnabled
              ? "Два режима активны"
              : mode === "mailbox"
                ? "Общий почтовый ящик"
                : "Вложенные ответы"}
          </StatCell>
          <StatCell label={mode === "mailbox" ? "Почтовый ящик" : "Домен ответа"}>
            <span className="truncate font-mono text-[13px]">
              {mode === "mailbox"
                ? mailboxStatus.address
                : inboundStatus.replyDomain}
            </span>
          </StatCell>
          <StatCell label={"Статус доставки"}>
            {mode === "mailbox" ? (
              mailboxStatus.lastSyncedAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={
                      mailboxStatus.lastError
                        ? "size-1.5 rounded-full bg-clay"
                        : "size-1.5 rounded-full bg-pine"
                    }
                  />
                  {"Синхронизировано "}{formatRelative(mailboxStatus.lastSyncedAt)}
                </span>
              ) : (
                "Никогда не синхронизировалось"
              )
            ) : inboundStatus.provider ? (
              <span className="inline-flex items-center gap-1.5">
                {inboundStatus.provider === "postmark" ? (
                  <PostmarkLogo className="size-4" />
                ) : (
                  <ResendLogo className="size-4" />
                )}
                {INBOUND_PROVIDER_LABEL[inboundStatus.provider]}
              </span>
            ) : (
              "Не настроено"
            )}
          </StatCell>
        </div>
      ) : null}

      {mailboxStatus.lastError && mode === "mailbox" ? (
        <div className="mx-6 mb-6 flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/5 px-3 py-2 text-sm text-clay">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
          <p>{"Последняя ошибка синхронизации почтового ящика: "}{mailboxStatus.lastError}</p>
        </div>
      ) : null}
    </Card>
  );
}

export function ReplyHandlingSettingsForm({
  mailboxStatus,
  inboundStatus,
  workspaceId,
  initialMode,
  appUrl,
}: {
  mailboxStatus: MailboxStatus;
  inboundStatus: WorkspaceInboundEmailStatus;
  workspaceId: string;
  initialMode: ReplyMode;
  appUrl: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ReplyMode>(initialMode);
  const [saving, startSave] = useTransition();

  const mailboxForm = useState({
    address: mailboxStatus.address ?? "",
    imapHost: mailboxStatus.imapHost ?? "",
    imapPort: String(mailboxStatus.imapPort ?? 993),
    imapTls: mailboxStatus.imapTls || !mailboxStatus.configured,
    imapUser: mailboxStatus.imapUser ?? "",
    imapPassword: "",
    sourceFolder: mailboxStatus.sourceFolder ?? "INBOX",
    smtpHost: mailboxStatus.smtpHost ?? "",
    smtpPort: String(mailboxStatus.smtpPort ?? 465),
    smtpTls: mailboxStatus.smtpTls || !mailboxStatus.configured,
    smtpUser: mailboxStatus.smtpUser ?? "",
    smtpPassword: "",
    sentFolder: mailboxStatus.sentFolder ?? "Отправлено",
  });
  const [mailboxEnabled, setMailboxEnabled] = useState(
    mailboxStatus.enabled || !mailboxStatus.configured,
  );
  const [provider, setProvider] = useState<InboundProviderId>(
    inboundStatus.provider ?? "resend",
  );
  const [replyDomain, setReplyDomain] = useState(
    inboundStatus.replyDomain ?? "",
  );
  const [webhookSecret, setWebhookSecret] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [inboundEnabled, setInboundEnabled] = useState(
    inboundStatus.enabled || !inboundStatus.hasWebhookSecret,
  );

  const [form, setForm] = mailboxForm;
  const setMailboxField = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const webhookUrl = `${appUrl}/api/webhooks/email/${provider}?ws=${workspaceId}`;

  function save() {
    startSave(async () => {
      if (mode === "mailbox") {
        const result = await saveMailboxSettingsAction({
          ...form,
          enabled: mailboxEnabled,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Не удалось сохранить обработку ответа.");
          return;
        }

        // The two transports are alternatives. Keep the workspace in one
        // deterministic reply mode, including for existing workspaces that
        // had both legacy settings enabled.
        const disabled = await disableInboundEmailAction();
        if (!disabled.ok) {
          toast.error(disabled.error ?? "Не удалось отключить ветку ответов.");
          return;
        }
      } else {
        const result = await saveInboundEmailSettingsAction({
          enabled: inboundEnabled,
          provider,
          replyDomain,
          webhookSecret: webhookSecret || undefined,
          resendApiKey:
            provider === "resend" ? resendApiKey || undefined : undefined,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Не удалось сохранить обработку ответа.");
          return;
        }

        const disabled = await disableMailboxSettingsAction();
        if (!disabled.ok) {
          toast.error(
            disabled.error ?? "Не удалось отключить общий почтовый ящик.",
          );
          return;
        }
      }

      toast.success("Настройки обработки ответов сохранены.");
      router.refresh();
    });
  }

  return (
    <DrawerLayout
      title={"Настройка входящей электронной почты кандидата"}
      description={"Выберите, как Харли будет получать ответы. Общий почтовый ящик позволяет читать и отправлять сообщения из папки «Входящие»; вложенные ответы импортируют новые сообщения через функцию «Повторная отправка» или «Почтовая марка»."}
      surface="page"
      footer={
        <Button
          onClick={save}
          disabled={saving || !mailboxStatus.encryptionReady}
        >
          {saving ? <SpinnerIcon className="size-4" /> : null}
          {"Сохранить изменения "}</Button>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>{"Маршрут ответа"}</Label>
          <Select
            value={mode}
            onValueChange={(value) => setMode(value as ReplyMode)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mailbox">{"Общий почтовый ящик (IMAP + SMTP)"}</SelectItem>
              <SelectItem value="threaded">
                {"Вложенные ответы (вебхук «Повторная отправка/отметка») "}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {"Одновременно активен только один маршрут. Вы можете переключиться позже, не теряя сохраненную конфигурацию для другого маршрута. "}</p>
        </div>

        {mode === "mailbox" ? (
          <SharedMailboxFields
            form={form}
            status={mailboxStatus}
            enabled={mailboxEnabled}
            onFieldChange={setMailboxField}
            onEnabledChange={setMailboxEnabled}
          />
        ) : (
          <ThreadedReplyFields
            status={inboundStatus}
            provider={provider}
            replyDomain={replyDomain}
            webhookSecret={webhookSecret}
            resendApiKey={resendApiKey}
            enabled={inboundEnabled}
            webhookUrl={webhookUrl}
            onProviderChange={setProvider}
            onReplyDomainChange={setReplyDomain}
            onWebhookSecretChange={setWebhookSecret}
            onResendApiKeyChange={setResendApiKey}
            onEnabledChange={setInboundEnabled}
          />
        )}
      </div>
    </DrawerLayout>
  );
}

function SharedMailboxFields({
  form,
  status,
  enabled,
  onFieldChange,
  onEnabledChange,
}: {
  form: {
    address: string;
    imapHost: string;
    imapPort: string;
    imapTls: boolean;
    imapUser: string;
    imapPassword: string;
    sourceFolder: string;
    smtpHost: string;
    smtpPort: string;
    smtpTls: boolean;
    smtpUser: string;
    smtpPassword: string;
    sentFolder: string;
  };
  status: MailboxStatus;
  enabled: boolean;
  onFieldChange: (key: keyof typeof form, value: string | boolean) => void;
  onEnabledChange: (value: boolean) => void;
}) {
  const [testingConnection, startTest] = useTransition();

  function test() {
    startTest(async () => {
      const result = await testMailboxConnectionAction();
      if (!result.ok) {
        toast.error(result.error ?? "Проверка соединения не удалась.");
        return;
      }
      toast.success("Соединение IMAP исправно");
    });
  }

  const set = onFieldChange;
  const passwordPlaceholder = (hasSecret: boolean) =>
    hasSecret ? "•••••••• (сохранено, оставьте пустым, чтобы сохранить)" : undefined;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="reply-mailbox-address">{"Адрес почтового ящика"}</Label>
        <Input
          id="reply-mailbox-address"
          type="email"
          value={form.address}
          onChange={(event) => set("address", event.target.value)}
          placeholder="jobs@yourcompany.com"
        />
        <p className="text-xs text-muted-foreground">
          {"Новые сообщения импортируются из этого общего почтового ящика, а ответы, отправляемые из этого почтового ящика, используют его учетную запись SMTP. "}</p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {"Входящий (IMAP) "}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={"Хост"} htmlFor="reply-imap-host">
            <Input
              id="reply-imap-host"
              value={form.imapHost}
              onChange={(event) => set("imapHost", event.target.value)}
              placeholder="imap.yourcompany.com"
              className="font-mono text-xs"
            />
          </Field>
          <Field label={"Порт"} htmlFor="reply-imap-port">
            <Input
              id="reply-imap-port"
              inputMode="numeric"
              value={form.imapPort}
              onChange={(event) => set("imapPort", event.target.value)}
              placeholder="993"
            />
          </Field>
        </div>
        <Field label={"Имя пользователя"} htmlFor="reply-imap-user">
          <Input
            id="reply-imap-user"
            value={form.imapUser}
            onChange={(event) => set("imapUser", event.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label={"Пароль"} htmlFor="reply-imap-password">
          <Input
            id="reply-imap-password"
            type="password"
            value={form.imapPassword}
            onChange={(event) => set("imapPassword", event.target.value)}
            placeholder={passwordPlaceholder(status.hasImapPassword)}
            autoComplete="off"
          />
        </Field>
        <Field label={"Исходная папка"} htmlFor="reply-source-folder">
          <Input
            id="reply-source-folder"
            value={form.sourceFolder}
            onChange={(event) => set("sourceFolder", event.target.value)}
            placeholder={"Входящие"}
          />
        </Field>
        <TlsToggle
          label={"Используйте TLS"}
          checked={form.imapTls}
          onCheckedChange={(value) => set("imapTls", value)}
          ariaLabel={"Используйте IMAP TLS"}
        />
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {"Транспорт ответа (SMTP) "}</p>
        <p className="text-xs text-muted-foreground">
          {"Используется только для ответов, отправленных из общего почтового ящика. Для общих электронных писем кандидатов используются указанные выше настройки доставки электронной почты. "}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={"Хост"} htmlFor="reply-smtp-host">
            <Input
              id="reply-smtp-host"
              value={form.smtpHost}
              onChange={(event) => set("smtpHost", event.target.value)}
              placeholder="smtp.yourcompany.com"
              className="font-mono text-xs"
            />
          </Field>
          <Field label={"Порт"} htmlFor="reply-smtp-port">
            <Input
              id="reply-smtp-port"
              inputMode="numeric"
              value={form.smtpPort}
              onChange={(event) => set("smtpPort", event.target.value)}
              placeholder="465"
            />
          </Field>
        </div>
        <Field label={"Имя пользователя"} htmlFor="reply-smtp-user">
          <Input
            id="reply-smtp-user"
            value={form.smtpUser}
            onChange={(event) => set("smtpUser", event.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label={"Пароль"} htmlFor="reply-smtp-password">
          <Input
            id="reply-smtp-password"
            type="password"
            value={form.smtpPassword}
            onChange={(event) => set("smtpPassword", event.target.value)}
            placeholder={passwordPlaceholder(status.hasSmtpPassword)}
            autoComplete="off"
          />
        </Field>
        <Field label={"Отправленная папка"} htmlFor="reply-sent-folder">
          <Input
            id="reply-sent-folder"
            value={form.sentFolder}
            onChange={(event) => set("sentFolder", event.target.value)}
            placeholder={"Отправлено"}
          />
        </Field>
        <TlsToggle
          label={"Используйте TLS"}
          checked={form.smtpTls}
          onCheckedChange={(value) => set("smtpTls", value)}
          ariaLabel={"Используйте SMTP TLS"}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">{"Включить общий почтовый ящик"}</p>
          <p className="text-xs text-muted-foreground">
            {"Новая почта опрашивается локальным cron. "}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={test}
        disabled={testingConnection || !status.configured}
      >
        {testingConnection ? (
          <SpinnerIcon className="size-4" />
        ) : (
          <ArrowsClockwiseIcon className="size-4" />
        )}
        {"Проверить соединение IMAP "}</Button>
    </div>
  );
}

function ThreadedReplyFields({
  status,
  provider,
  replyDomain,
  webhookSecret,
  resendApiKey,
  enabled,
  webhookUrl,
  onProviderChange,
  onReplyDomainChange,
  onWebhookSecretChange,
  onResendApiKeyChange,
  onEnabledChange,
}: {
  status: WorkspaceInboundEmailStatus;
  provider: InboundProviderId;
  replyDomain: string;
  webhookSecret: string;
  resendApiKey: string;
  enabled: boolean;
  webhookUrl: string | null;
  onProviderChange: (value: InboundProviderId) => void;
  onReplyDomainChange: (value: string) => void;
  onWebhookSecretChange: (value: string) => void;
  onResendApiKeyChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>{"Поставщик"}</Label>
        <Select
          value={provider}
          onValueChange={(value) =>
            onProviderChange(value as InboundProviderId)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="resend">
              <span className="inline-flex items-center gap-2">
                <ResendLogo className="size-4" />
                {"Отправить повторно "}</span>
            </SelectItem>
            <SelectItem value="postmark">
              <span className="inline-flex items-center gap-2">
                <PostmarkLogo className="size-4" />
                {"Почтовый штемпель "}</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Field label={"Домен ответа"} htmlFor="reply-domain">
        <Input
          id="reply-domain"
          value={replyDomain}
          onChange={(event) => onReplyDomainChange(event.target.value)}
          placeholder="reply.yourcompany.com"
          className="font-mono text-xs"
        />
          <p className="text-xs text-muted-foreground">
          {"Укажите запись MX здесь у своего провайдера. Харли предоставляет каждому приложению собственный ответный адрес в этом домене. "}</p>
      </Field>

      <Field
        label={
          provider === "postmark"
            ? "Основной пароль авторизации"
            : "Секрет подписи вебхука"
        }
        htmlFor="reply-webhook-secret"
      >
        <Input
          id="reply-webhook-secret"
          type="password"
          value={webhookSecret}
          onChange={(event) => onWebhookSecretChange(event.target.value)}
          placeholder={
            status.hasWebhookSecret
              ? "•••••••• (сохранено, оставьте пустым, чтобы сохранить)"
              : provider === "postmark"
                ? "Установите это как пароль базовой аутентификации URL-адреса."
                : "где_…"
          }
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          {provider === "postmark"
            ? "В Postmark нет схемы подписи веб-перехватчика. Защитите URL-адрес с помощью базовой аутентификации."
            : "Откройте «Повторная отправка» → «Вебхуки» после выбора события email.received."}
        </p>
      </Field>

      {provider === "resend" ? (
        <Field label={"Повторно отправить ключ API"} htmlFor="reply-resend-key">
          <Input
            id="reply-resend-key"
            type="password"
            value={resendApiKey}
            onChange={(event) => onResendApiKeyChange(event.target.value)}
            placeholder={
              status.hasResendApiKey
                ? "•••••••• (сохранено, оставьте пустым, чтобы сохранить)"
                : "ре_…"
            }
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            {"Используется для получения тела электронного письма после срабатывания веб-перехватчика. Требуется область получения электронной почты. "}</p>
        </Field>
      ) : null}

      {webhookUrl ? (
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
          <Label>{"URL вебхука"}</Label>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                void navigator.clipboard.writeText(webhookUrl);
                toast.success("URL-адрес вебхука скопирован.");
              }}
              aria-label={"Скопировать URL-адрес вебхука"}
            >
              <CopyIcon className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {"Добавьте этот URL-адрес в настройки входящего веб-перехватчика вашего провайдера. "}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">{"Получайте ответы кандидатов автоматически"}</p>
          <p className="text-xs text-muted-foreground">
            {"Ответы направляются непосредственно на временную шкалу кандидата. "}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function TlsToggle({
  label,
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
      <p className="text-sm font-medium">{label}</p>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel}
      />
    </div>
  );
}
