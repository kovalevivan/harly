"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import {
  disableEmailAction,
  saveEmailSettingsAction,
  sendTestEmailAction,
} from "@/features/workspaces/email-settings-actions";
import type { EmailProviderId, WorkspaceEmailStatus } from "@/lib/email/config";
import {
  SectionHeader,
  StatCell,
  StatusPill,
} from "@/features/workspaces/settings-ui";
import { DrawerLayout } from "@/features/candidates/DrawerLayout";
import { ResendLogo } from "@/components/ui/icons/brands";
import {
  KeyDuotoneIcon,
  PaperPlaneDuotoneIcon,
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

const PROVIDER_LABEL: Record<EmailProviderId, string> = {
  resend: "Отправить повторно",
  smtp: "SMTP",
};

export function EmailSettingsCard({
  status,
  canEdit,
}: {
  status: WorkspaceEmailStatus;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [togglePending, startToggle] = useTransition();

  const isConfigured = Boolean(status.from);

  function toggleEnabled(next: boolean) {
    if (!isConfigured && next) {
      toast.error("Сначала настройте параметры электронной почты.");
      return;
    }
    startToggle(async () => {
      const result = next
        ? await saveEmailSettingsAction({
            enabled: true,
            provider: status.provider ?? "resend",
            from: status.from ?? "",
          })
        : await disableEmailAction();
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить.");
        return;
      }
      toast.success(next ? "Электронная почта включена" : "Электронная почта отключена");
      router.refresh();
    });
  }

  const badge = isConfigured ? (
    <StatusPill tone={status.enabled ? "on" : "off"}>
      {status.enabled ? "Подключено" : "Отключено"}
    </StatusPill>
  ) : status.usingPlatformDefault ? (
    <StatusPill tone="neutral">{"Почти по умолчанию"}</StatusPill>
  ) : (
    <StatusPill tone="neutral">{"Не подключено"}</StatusPill>
  );

  return (
    <div className="space-y-5">
      {!status.encryptionReady ? <EncryptionWarning /> : null}
      <Card className="gap-0 overflow-hidden p-0">
        <div className="p-6">
          <SectionHeader
            icon={EnvelopeIcon}
            title={"Доставка по электронной почте"}
            badge={badge}
            description={"Отправляйте электронные письма кандидатам и рекрутерам со своего домена посредством повторной отправки или SMTP. Без него Харли отправляет с общего адреса."}
            action={
              canEdit ? (
                <>
                  {status.encryptionReady ? (
                    <Button asChild variant={isConfigured ? "outline" : "default"}>
                      <Link href={"/settings/email/configure" as Route}>
                        <KeyDuotoneIcon className="size-4" />
                        {isConfigured ? "Управление" : "Подключиться"}
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="default" disabled>
                      <KeyDuotoneIcon className="size-4" />
                      {"Подключиться "}</Button>
                  )}
                  {isConfigured ? (
                    <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                      <Switch
                        checked={status.enabled}
                        disabled={togglePending}
                        onCheckedChange={toggleEnabled}
                        aria-label={"Включить электронную почту"}
                      />
                      <span className="text-muted-foreground">
                        {status.enabled ? "On" : "Выкл."}
                      </span>
                    </label>
                  ) : null}
                </>
              ) : null
            }
          />
        </div>

        <div className="grid grid-cols-1 divide-y border-t bg-muted/20 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <StatCell label={"Поставщик"}>
            {status.provider === "resend" ? (
              <ResendLogo className="size-3.5" />
            ) : (
              <EnvelopeIcon className="size-4 text-muted-foreground" />
            )}
            {PROVIDER_LABEL[status.provider!]}
          </StatCell>
          <StatCell label={"С адреса"}>
            <span className="truncate font-mono text-[13px]">
              {status.from}
            </span>
          </StatCell>
        </div>
      </Card>
    </div>
  );
}

function EncryptionWarning() {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
      <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
      <p>
        {"Установить "}<code className="font-mono text-xs">AI_ENCRYPTION_KEY</code> {"на сервере для хранения учетных данных электронной почты. "}</p>
    </div>
  );
}

export function EmailSettingsForm({ status }: {
  status: WorkspaceEmailStatus;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<EmailProviderId>(
    status.provider ?? "resend",
  );
  const [from, setFrom] = useState(status.from ?? "");
  const [apiKey, setApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState(status.smtpHost ?? "");
  const [smtpPort, setSmtpPort] = useState(
    status.smtpPort ? String(status.smtpPort) : "",
  );
  const [smtpSecure, setSmtpSecure] = useState(status.smtpSecure);
  const [smtpUser, setSmtpUser] = useState(status.smtpUser ?? "");
  const [enabled, setEnabled] = useState(
    status.enabled || (!status.from && !status.hasSecret),
  );
  const [testing, startTest] = useTransition();
  const [saving, startSave] = useTransition();

  function fieldsForAction() {
    return {
      provider,
      from,
      apiKey: apiKey || undefined,
      smtpHost: provider === "smtp" ? smtpHost || undefined : undefined,
      smtpPort: provider === "smtp" ? smtpPort || undefined : undefined,
      smtpSecure: provider === "smtp" ? smtpSecure : undefined,
      smtpUser: provider === "smtp" ? smtpUser || undefined : undefined,
    };
  }

  function runTest() {
    startTest(async () => {
      const result = await sendTestEmailAction(fieldsForAction());
      if (!result.ok) {
        toast.error(result.error ?? "Тест не пройден.");
        return;
      }
      toast.success(
        provider === "smtp"
          ? "SMTP-соединение проверено"
          : "Тестовое письмо отправлено. Проверьте свой почтовый ящик",
      );
    });
  }

  function save() {
    startSave(async () => {
      const result = await saveEmailSettingsAction({
        ...fieldsForAction(),
        enabled,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить.");
        return;
      }
      toast.success("Настройки электронной почты сохранены.");
      router.refresh();
    });
  }

  const canTest =
    from.trim().length > 0 &&
    (provider === "resend"
      ? Boolean(apiKey || status.hasSecret)
      : smtpHost.trim().length > 0 && smtpPort.trim().length > 0);

  return (
    <DrawerLayout
      title={"Настроить электронную почту"}
      description={"Секреты зашифровываются и никогда больше не отображаются."}
      surface="page"
      footer={
        <Button onClick={save} disabled={saving || !from.trim()}>
          {saving ? <SpinnerIcon className="size-4" /> : null}
          {"Сохранить изменения "}</Button>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>{"Поставщик"}</Label>
          <Select
            value={provider}
            onValueChange={(value) => setProvider(value as EmailProviderId)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="resend">{"Отправить повторно"}</SelectItem>
              <SelectItem value="smtp">{"SMTP (пользовательский, AWS SES и т. д.)"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-from">{"С адреса"}</Label>
          <Input
            id="email-from"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            placeholder="Acme <hello@acme.com>"
          />
          <p className="text-xs text-muted-foreground">
            {"Должен быть проверенным отправителем или доменом вашего провайдера. "}</p>
        </div>

        {provider === "resend" ? (
          <div className="space-y-2">
            <Label htmlFor="email-api-key">{"Повторно отправить ключ API"}</Label>
            <Input
              id="email-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                status.hasSecret
                  ? "•••••••• (сохранено, оставьте пустым, чтобы сохранить)"
                  : "re_xxxxxxxxxxxxxxxxxxxx"
              }
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {"Повторная отправка → Ключи API. Требуется разрешение на отправку из вашего домена. "}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email-smtp-host">{"SMTP-хост"}</Label>
                <Input
                  id="email-smtp-host"
                  value={smtpHost}
                  onChange={(event) => setSmtpHost(event.target.value)}
                  placeholder="email-smtp.us-east-1.amazonaws.com"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-smtp-port">{"Порт"}</Label>
                <Input
                  id="email-smtp-port"
                  inputMode="numeric"
                  value={smtpPort}
                  onChange={(event) => setSmtpPort(event.target.value)}
                  placeholder="587"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-smtp-user">{"Имя пользователя"}</Label>
              <Input
                id="email-smtp-user"
                value={smtpUser}
                onChange={(event) => setSmtpUser(event.target.value)}
                placeholder={"Имя пользователя SMTP"}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-smtp-pass">{"Пароль"}</Label>
              <Input
                id="email-smtp-pass"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  status.hasSecret
                    ? "•••••••• (сохранено, оставьте пустым, чтобы сохранить)"
                    : "SMTP-пароль"
                }
                autoComplete="off"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{"Используйте TLS"}</p>
                <p className="text-xs text-muted-foreground">
                  {"Включите порт 465. Оставьте порт 587/25 (STARTTLS). "}</p>
              </div>
              <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} />
            </div>
          </>
        )}

        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">{"Включить"}</p>
            <p className="text-xs text-muted-foreground">
              {"Если этот параметр отключен, Харли вместо этого отправляет сообщения со своего общего адреса. "}</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={runTest}
          disabled={testing || !canTest}
        >
          {testing ? (
            <SpinnerIcon className="size-4" />
          ) : (
            <PaperPlaneDuotoneIcon className="size-4" />
          )}
          {provider === "smtp" ? "Тестовое соединение" : "Отправить тестовое письмо"}
        </Button>
      </div>
    </DrawerLayout>
  );
}
