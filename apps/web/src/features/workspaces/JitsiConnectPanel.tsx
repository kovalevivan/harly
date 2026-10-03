"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import {
  disconnectJitsiAction,
  saveJitsiSettingsAction,
  testJitsiConnectionAction,
} from "@/features/workspaces/jitsi-settings-actions";
import type { WorkspaceJitsiStatus } from "@/lib/jitsi/config";
import {
  IntegrationHeader,
  InlineReveal,
} from "@/features/workspaces/IntegrationDetailShell";
import { StatCell } from "@/features/workspaces/settings-ui";
import { TheSvgLogo } from "@/components/ui/icons/brands";
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  GearSixIcon,
  KeyDuotoneIcon,
  SpinnerIcon,
  WarningCircleIcon,
} from "@/components/ui/icons/phosphor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function JitsiLogo({ className }: { className?: string }) {
  return <TheSvgLogo slug="jitsi" alt={"Jitsi"} className={className} />;
}

type TestState =
  | { kind: "idle" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function JitsiConnectPanel({
  status,
  canEdit,
  tileClassName,
  description,
}: {
  status: WorkspaceJitsiStatus;
  canEdit: boolean;
  tileClassName: string;
  description: string;
}) {
  const router = useRouter();
  const isConfigured = Boolean(status.baseUrl);
  const [open, setOpen] = useState(isConfigured);
  const [togglePending, startToggle] = useTransition();

  const statusTone = isConfigured
    ? status.enabled
      ? "on"
      : "off"
    : "neutral";
  const statusLabel = isConfigured
    ? status.enabled
      ? "Подключено"
      : "Отключено"
    : "Не подключено";

  function toggleEnabled(next: boolean) {
    if (!status.baseUrl) {
      toast.error("Сначала добавьте URL-адрес экземпляра.");
      return;
    }
    startToggle(async () => {
      const result = await saveJitsiSettingsAction({
        enabled: next,
        baseUrl: status.baseUrl!,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить.");
        return;
      }
      toast.success(next ? "Джитси включен" : "Джитси отключен");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <IntegrationHeader
        logo={JitsiLogo}
        logoClassName="size-9"
        tileClassName={tileClassName}
        name="Jitsi Meet"
        description={description}
        statusLabel={statusLabel}
        statusTone={statusTone}
        action={
          canEdit ? (
            <>
              <Button
                variant={isConfigured ? "outline" : "default"}
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
              >
                {isConfigured ? (
                  <GearSixIcon className="size-4" />
                ) : (
                  <KeyDuotoneIcon className="size-4" />
                )}
                {isConfigured ? (open ? "Скрыть настройки" : "Управление") : "Подключиться"}
              </Button>
              {isConfigured ? (
                <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                  <Switch
                    checked={status.enabled}
                    disabled={togglePending}
                    onCheckedChange={toggleEnabled}
                    aria-label={"Включить Джитси"}
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

      {isConfigured ? (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <StatCell label={"Экземпляр"}>
              <JitsiLogo className="size-4" />
              <span className="truncate">{status.baseUrl}</span>
            </StatCell>
            <StatCell label={"Номера"}>
              <span className="text-muted-foreground">
                {"Генерируется для каждого интервью (случайный код) "}</span>
            </StatCell>
          </div>
        </Card>
      ) : null}

      {canEdit ? (
        <InlineReveal open={open}>
          <JitsiConnectForm
            status={status}
            onSaved={() => router.refresh()}
          />
        </InlineReveal>
      ) : null}
    </div>
  );
}

function JitsiConnectForm({
  status,
  onSaved,
}: {
  status: WorkspaceJitsiStatus;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState(status.baseUrl ?? "");
  const [enabled, setEnabled] = useState(status.enabled || !status.baseUrl);
  const [test, setTest] = useState<TestState>({ kind: "idle" });
  const [testing, startTest] = useTransition();
  const [saving, startSave] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();

  const isPublicInstance = baseUrl.trim().replace(/\/+$/, "") === "https://meet.jit.si";

  function testConnection() {
    startTest(async () => {
      setTest({ kind: "idle" });
      const result = await testJitsiConnectionAction({
        baseUrl: baseUrl || undefined,
      });
      if (result.ok) {
        setTest({ kind: "ok" });
        toast.success("Экземпляр доступен");
      } else {
        setTest({
          kind: "error",
          message: result.error ?? "Не удалось связаться с этим экземпляром.",
        });
      }
    });
  }

  function save() {
    startSave(async () => {
      const result = await saveJitsiSettingsAction({ enabled, baseUrl });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить.");
        return;
      }
      toast.success("Настройки Jitsi сохранены.");
      onSaved();
    });
  }

  function disconnect() {
    startDisconnect(async () => {
      const result = await disconnectJitsiAction();
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось отключиться.");
        return;
      }
      toast.success("Джитси отключен");
      router.refresh();
    });
  }

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="font-display text-base font-semibold tracking-tight">
            {status.baseUrl ? "Управление подключением" : "Подключите Jitsi Meet"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {"Видеоинтервью получают уникальную ссылку на комнату в вашем экземпляре. Никакая учетная запись или ключ API не требуются. "}</p>
        </div>
        <a
          href="https://jitsi.github.io/handbook/docs/devops-guide/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-pine transition-colors hover:text-pine-strong"
        >
          {"Руководство для самостоятельного размещения "}<ArrowUpRightIcon className="size-3.5" />
        </a>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="jitsi-base">{"Базовый URL-адрес экземпляра"}</Label>
          <Input
            id="jitsi-base"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setTest({ kind: "idle" });
            }}
            placeholder="https://meet.jit.si"
            autoComplete="off"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            {"Ваш собственный экземпляр или общедоступный https://meet.jit.si. "}</p>
        </div>

        {isPublicInstance ? (
          <div className="flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/5 px-3 py-2 text-sm text-clay">
            <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              {"Комнаты на публичном сайте meet.jit.si открыты для всех, у кого есть ссылка. Коды комнат случайны и не поддаются угадыванию, но для деликатных интервью лучше использовать автономный экземпляр с вестибюлем. "}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">{"Включить Джитси"}</p>
            <p className="text-xs text-muted-foreground">
              {"Используется для видеоинтервью, когда Zoom, Teams и Google Meet не подключены. "}</p>
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

      <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
        {status.baseUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={disconnect}
            disabled={disconnecting}
          >
            {disconnecting ? <SpinnerIcon className="size-3.5" /> : null}
            {"Отключить "}</Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={testing || !baseUrl.trim()}
          >
            {testing ? (
              <SpinnerIcon className="size-4" />
            ) : test.kind === "ok" ? (
              <CheckCircleIcon className="size-4 text-pine" />
            ) : null}
            {test.kind === "ok" ? "Экземпляр ОК" : "Тестовое соединение"}
          </Button>
          <Button onClick={save} disabled={saving || !baseUrl.trim()}>
            {saving ? <SpinnerIcon className="size-4" /> : null}
            {"Сохранить "}</Button>
        </div>
      </div>
    </Card>
  );
}
