"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import {
  disableCalAction,
  registerCalWebhookAction,
  saveCalSettingsAction,
  testCalConnectionAction,
} from "@/features/workspaces/cal-settings-actions";
import type { WorkspaceCalStatus } from "@/lib/cal/config";
import {
  IntegrationHeader,
  InlineReveal,
} from "@/features/workspaces/IntegrationDetailShell";
import { StatCell } from "@/features/workspaces/settings-ui";
import { CalcomLogo } from "@/components/ui/icons/brands";
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  CopyIcon,
  GearSixIcon,
  KeyDuotoneIcon,
  SpinnerIcon,
  WarningCircleIcon,
  WebhooksDuotoneIcon,
} from "@/components/ui/icons/phosphor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type TestState =
  | { kind: "idle" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function CalConnectPanel({
  status,
  canEdit,
  webhookUrl,
  tileClassName,
  description,
}: {
  status: WorkspaceCalStatus;
  canEdit: boolean;
  webhookUrl: string | null;
  tileClassName: string;
  description: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(status.hasApiKey);
  const [togglePending, startToggle] = useTransition();

  const statusTone = status.hasApiKey
    ? status.enabled
      ? "on"
      : "off"
    : "neutral";
  const statusLabel = status.hasApiKey
    ? status.enabled
      ? "Подключено"
      : "Отключено"
    : "Не подключено";

  function toggleEnabled(next: boolean) {
    if (!status.hasApiKey && next) {
      toast.error("Сначала добавьте ключ API Cal.com.");
      return;
    }
    startToggle(async () => {
      const result = next
        ? await saveCalSettingsAction({ enabled: true })
        : await disableCalAction();
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить.");
        return;
      }
      toast.success(next ? "Cal.com включен" : "Cal.com отключен");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <IntegrationHeader
        logo={CalcomLogo}
        tileClassName={tileClassName}
        name="Cal.com"
        description={description}
        statusLabel={statusLabel}
        statusTone={statusTone}
        action={
          canEdit ? (
            <>
              <Button
                variant={status.hasApiKey ? "outline" : "default"}
                disabled={!status.encryptionReady}
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
              >
                {status.hasApiKey ? (
                  <GearSixIcon className="size-4" />
                ) : (
                  <KeyDuotoneIcon className="size-4" />
                )}
                {status.hasApiKey
                  ? open
                    ? "Скрыть настройки"
                    : "Управление"
                  : "Подключиться"}
              </Button>
              {status.hasApiKey ? (
                <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                  <Switch
                    checked={status.enabled}
                    disabled={togglePending}
                    onCheckedChange={toggleEnabled}
                    aria-label={"Включить Cal.com"}
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

      {!status.encryptionReady ? (
        <div className="flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/5 px-3 py-2 text-sm text-clay">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            {"Установить "}<code className="font-mono text-xs">AI_ENCRYPTION_KEY</code> {"на сервере для хранения ключа Cal.com. "}</p>
        </div>
      ) : null}

      {status.hasApiKey ? (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <StatCell label={"Страница бронирования"}>
              <span className="truncate text-muted-foreground">
                {status.bookingUrl ?? "Не установлено"}
              </span>
            </StatCell>
            <StatCell label={"Тип события"}>
              <span className="font-mono text-[13px]">
                {status.defaultEventTypeId
                  ? `#${status.defaultEventTypeId}`
                  : "Не настроено"}
              </span>
            </StatCell>
            <StatCell label={"Вебхук"}>
              <WebhookCell canEdit={canEdit} status={status} />
            </StatCell>
          </div>
        </Card>
      ) : null}

      {canEdit ? (
        <InlineReveal open={open}>
          <CalConnectForm
            status={status}
            webhookUrl={webhookUrl}
            onSaved={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </InlineReveal>
      ) : null}
    </div>
  );
}

function WebhookCell({
  canEdit,
  status,
}: {
  canEdit: boolean;
  status: WorkspaceCalStatus;
}) {
  const router = useRouter();
  const [registering, startRegister] = useTransition();

  function registerWebhook() {
    startRegister(async () => {
      const result = await registerCalWebhookAction();
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось зарегистрировать вебхук.");
        return;
      }
      toast.success("Вебхук зарегистрирован на Cal.com");
      router.refresh();
    });
  }

  if (!canEdit) {
    return <span>{status.hasWebhookSecret ? "Активные" : "Не установлено"}</span>;
  }

  return (
    <button
      type="button"
      onClick={registerWebhook}
      disabled={registering}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-pine transition-colors hover:text-pine-strong disabled:opacity-60"
    >
      {registering ? (
        <SpinnerIcon className="size-3.5" />
      ) : (
        <WebhooksDuotoneIcon className="size-3.5" />
      )}
      {status.hasWebhookSecret ? "Re-register" : "Зарегистрироваться"}
    </button>
  );
}

function CalConnectForm({
  status,
  webhookUrl,
  onSaved,
}: {
  status: WorkspaceCalStatus;
  webhookUrl: string | null;
  onSaved: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(status.baseUrl);
  const [bookingUrl, setBookingUrl] = useState(status.bookingUrl ?? "");
  const [eventTypeId, setEventTypeId] = useState(
    status.defaultEventTypeId ? String(status.defaultEventTypeId) : "",
  );
  const [enabled, setEnabled] = useState(status.enabled || !status.hasApiKey);
  const [test, setTest] = useState<TestState>({ kind: "idle" });
  const [testing, startTest] = useTransition();
  const [saving, startSave] = useTransition();

  function testConnection() {
    startTest(async () => {
      setTest({ kind: "idle" });
      const result = await testCalConnectionAction({ apiKey, baseUrl });
      if (result.ok) {
        setTest({ kind: "ok" });
        toast.success("Cal.com доступен с помощью этого ключа");
      } else {
        setTest({
          kind: "error",
          message: result.error ?? "Не удалось связаться с Cal.com.",
        });
      }
    });
  }

  function save() {
    startSave(async () => {
      const result = await saveCalSettingsAction({
        enabled,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        bookingUrl: bookingUrl || undefined,
        defaultEventTypeId: eventTypeId || undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить.");
        return;
      }
      toast.success("Настройки Cal.com сохранены.");
      onSaved();
    });
  }

  function copyWebhook() {
    if (!webhookUrl) return;
    void navigator.clipboard.writeText(webhookUrl);
    toast.success("URL-адрес вебхука скопирован.");
  }

  const canTest = Boolean(apiKey.trim()) || status.hasApiKey;

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="font-display text-base font-semibold tracking-tight">
            {status.hasApiKey ? "Управление подключением" : "Подключите Cal.com"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {"Ваш ключ API зашифрован и никогда больше не отображается. "}</p>
        </div>
        <a
          href="https://cal.com/docs/api-reference/v2/introduction"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-pine transition-colors hover:text-pine-strong"
        >
          {"Документация по API "}<ArrowUpRightIcon className="size-3.5" />
        </a>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="cal-key">{"API-ключ"}</Label>
          <Input
            id="cal-key"
            type="password"
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              setTest({ kind: "idle" });
            }}
            placeholder={
              status.hasApiKey
                ? "•••••••• (сохранено, оставьте пустым, чтобы сохранить)"
                : "кал_лайв_…"
            }
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            {"Cal.com → Настройки → Разработчик →"}{" "}
            <a
              href="https://app.cal.com/settings/developer/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {"Ключи API "}</a>
            . Нужны права на запись и вебхуки.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cal-booking-url">{"URL страницы бронирования"}</Label>
          <Input
            id="cal-booking-url"
            value={bookingUrl}
            onChange={(event) => setBookingUrl(event.target.value)}
            placeholder="https://cal.com/your-team/interview"
          />
          <p className="text-xs text-muted-foreground">
            {"Кандидаты используют публичную ссылку для выбора места. Заполняется заранее для каждого кандидата. "}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="cal-event">{"Идентификатор типа события по умолчанию"}</Label>
            <Input
              id="cal-event"
              inputMode="numeric"
              value={eventTypeId}
              onChange={(event) => setEventTypeId(event.target.value)}
              placeholder="e.g. 123456"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cal-base">{"Базовый URL API"}</Label>
            <Input
              id="cal-base"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.cal.com/v2"
              className="font-mono text-xs"
            />
          </div>
        </div>

        {webhookUrl ? (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <Label>{"URL вебхука"}</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyWebhook}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {"Сначала сохраните, затем «Зарегистрировать веб-перехватчик» автоматически создаст его на Cal.com. Или добавьте этот URL-адрес вручную в разделе веб-перехватчиков Cal.com. "}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">{"Включить Cal.com"}</p>
            <p className="text-xs text-muted-foreground">
              {"Если параметр выключен, планирование остается ручным. "}</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {test.kind === "error" ? (
          <div className="flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/5 px-3 py-2 text-sm text-clay">
            <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
            <p>{test.message}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={testConnection}
          disabled={testing || !canTest || !status.encryptionReady}
        >
          {testing ? (
            <SpinnerIcon className="size-4" />
          ) : test.kind === "ok" ? (
            <CheckCircleIcon className="size-4 text-pine" />
          ) : null}
          {test.kind === "ok" ? "Соединение в порядке" : "Тестовое соединение"}
        </Button>
        <Button onClick={save} disabled={saving || !status.encryptionReady}>
          {saving ? <SpinnerIcon className="size-4" /> : null}
          {"Сохранить "}</Button>
      </div>
    </Card>
  );
}
