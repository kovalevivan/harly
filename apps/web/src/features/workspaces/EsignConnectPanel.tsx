"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import {
  disconnectEsignAction,
  saveEsignSettingsAction,
  testEsignAction,
} from "@/features/workspaces/esign-settings-actions";
import type { WorkspaceEsignStatus } from "@/lib/esign/config";
import {
  IntegrationHeader,
  InlineReveal,
} from "@/features/workspaces/IntegrationDetailShell";
import { StatCell } from "@/features/workspaces/settings-ui";
import { DocuSealLogo } from "@/components/ui/icons/brands";
import {
  ArrowUpRightIcon,
  GearSixIcon,
  KeyDuotoneIcon,
  SpinnerIcon,
  WarningCircleIcon,
} from "@/components/ui/icons/phosphor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * DocuSeal (self-hosted e-signature). BYO instance URL + API token (encrypted at
 * rest). A webhook secret is generated on save; the admin pastes the shown
 * webhook URL and configures the secret as X-DocuSeal-Secret.
 */
export function EsignConnectPanel({
  status,
  canEdit,
  webhookUrl,
  webhookSecret,
  tileClassName,
  description,
}: {
  status: WorkspaceEsignStatus;
  canEdit: boolean;
  /** Inbound webhook URL with workspace selector only (`?ws=`), or null. */
  webhookUrl: string | null;
  /** Shared secret sent as X-DocuSeal-Secret, never put in the URL. */
  webhookSecret: string | null;
  tileClassName: string;
  description: string;
}) {
  const router = useRouter();
  const connected = status.enabled && status.hasToken;
  const [open, setOpen] = useState(false);
  const [testing, startTest] = useTransition();

  function testConnection() {
    startTest(async () => {
      const result = await testEsignAction();
      if (result.ok) toast.success("Соединение DocuSeal работает!");
      else {
        toast.error(result.error ?? "Проверка соединения DocuSeal не удалась.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <IntegrationHeader
        logo={DocuSealLogo}
        tileClassName={tileClassName}
        name="DocuSeal"
        description={description}
        statusLabel={connected ? "Подключено" : "Не подключено"}
        statusTone={connected ? "on" : "neutral"}
        action={
          canEdit ? (
            <Button
              variant={connected ? "outline" : "default"}
              disabled={!status.encryptionReady}
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
            >
              {connected ? <GearSixIcon className="size-4" /> : <KeyDuotoneIcon className="size-4" />}
              {connected ? (open ? "Скрыть настройки" : "Управление") : "Подключиться"}
            </Button>
          ) : null
        }
      />

      {!status.encryptionReady && !connected ? (
        <div className="flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/5 px-3 py-2 text-sm text-clay">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
          <p>{"Установить "}<code className="font-mono text-xs">AI_ENCRYPTION_KEY</code> {"на сервере для безопасного хранения токена DocuSeal API."}</p>
        </div>
      ) : null}

      {connected ? (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <StatCell label={"Экземпляр"}>
              <DocuSealLogo className="size-4" />
              <span className="truncate">{status.url ?? "Подключено"}</span>
            </StatCell>
            <StatCell label={"Статус"}>
              <button type="button" onClick={testConnection} disabled={testing} className="flex items-center gap-1.5 text-sm font-medium text-pine hover:underline disabled:opacity-50">
                {testing ? <SpinnerIcon className="size-3.5" /> : null}
                {testing ? "Тестирование…" : "Тестовое соединение"}
              </button>
            </StatCell>
          </div>
        </Card>
      ) : null}

      {canEdit ? (
        <InlineReveal open={open}>
          {connected ? (
            <Card className="space-y-4 p-5">
              {webhookUrl ? (
                <div className="space-y-2 border-t pt-4">
                  <h2 className="font-display text-base font-semibold tracking-tight">{"Вебхук"}</h2>
                  <p className="text-sm text-muted-foreground">{"В вашем экземпляре DocuSeal → Настройки → Вебхуки добавьте эту конечную точку для "}<code className="font-mono text-xs">form.completed</code>, <code className="font-mono text-xs">form.declined</code>{"и "}<code className="font-mono text-xs">{"представление.*"}</code> {"события. URL-адрес содержит только селектор рабочей области."}</p>
                  <code className="block break-all rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">{webhookUrl}</code>
                  {webhookSecret ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-foreground">{"Заголовок аутентификации"}</p>
                      <code className="block break-all rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">X-DocuSeal-Secret: {webhookSecret}</code>
                      <p className="text-xs text-muted-foreground">{"Настройте это как заголовок HTTP в DocuSeal или в обратном прокси-сервере. Никогда не добавляйте секрет как "}<code className="font-mono text-xs">{"?секрет="}</code>.</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <ConnectForm status={status} onSaved={() => { setOpen(false); router.refresh(); }} />
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  startTest(async () => {
                    const result = await disconnectEsignAction();
                    if (!result.ok) {
                      toast.error(result.error ?? "Не удалось отключить DocuSeal.");
                      return;
                    }
                    toast.success("DocuSeal отключен");
                    router.refresh();
                  })
                }
                disabled={testing}
              >
                {"Отключить DocuSeal "}</Button>
            </Card>
          ) : (
            <ConnectForm status={status} onSaved={() => { setOpen(false); router.refresh(); }} />
          )}
        </InlineReveal>
      ) : null}
    </div>
  );
}

function ConnectForm({
  status,
  onSaved,
}: {
  status: WorkspaceEsignStatus;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState(status.url ?? "");
  const [apiToken, setApiToken] = useState("");
  const [enabled, setEnabled] = useState(status.enabled || !status.hasToken);
  const [saving, startSave] = useTransition();

  function save() {
    startSave(async () => {
      const result = await saveEsignSettingsAction({
        url,
        apiToken: apiToken || undefined,
        enabled,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить настройки DocuSeal.");
        return;
      }
      toast.success("Настройки DocuSeal сохранены.");
      onSaved();
    });
  }

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="font-display text-base font-semibold tracking-tight">
            {status.hasToken ? "Управление подключением" : "Подключить DocuSeal"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {"Наведите Харли на свой локальный экземпляр DocuSeal. Токен API шифруется в состоянии покоя и никогда больше не отображается. "}</p>
        </div>
        <a
          href="https://www.docuseal.com/docs/api"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-pine transition-colors hover:text-pine-strong"
        >
          {"Документы DocuSeal "}<ArrowUpRightIcon className="size-3.5" />
        </a>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="docuseal-url">{"URL-адрес экземпляра"}</Label>
          <Input
            id="docuseal-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://sign.yourcompany.com"
            autoComplete="off"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">{"Базовый URL-адрес вашего экземпляра DocuSeal (без /api)."}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="docuseal-token">{"API-токен"}</Label>
          <Input
            id="docuseal-token"
            type="password"
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            placeholder={status.hasToken ? "•••••••• (сохранено, оставьте пустым, чтобы сохранить)" : "Вставьте свой X-Auth-токен"}
            autoComplete="off"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">{"DocuSeal → Настройки → API. Зашифровано в состоянии покоя."}</p>
        </div>

        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">{"Включить DocuSeal"}</p>
            <p className="text-xs text-muted-foreground">{"Разрешить отправку документов и предложений на подпись."}</p>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 accent-pine"
            aria-label={"Включить DocuSeal"}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving || !url.trim() || (!apiToken.trim() && !status.hasToken)}>
          {saving ? <SpinnerIcon className="size-4" /> : null}
          {"Сохранить "}</Button>
      </div>
    </Card>
  );
}
