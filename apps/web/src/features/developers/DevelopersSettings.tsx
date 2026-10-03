"use client";

import { useMemo, useState, useTransition, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "@/lib/date-format";
import { toast } from "@/lib/notification-island/toast";

import {
  createApiKeyAction,
  createWebhookAction,
  deleteWebhookAction,
  listWebhookDeliveriesAction,
  replayWebhookDeliveryAction,
  revokeApiKeyAction,
  rotateWebhookSecretAction,
  testWebhookAction,
  updateWebhookAction,
} from "@/features/developers/actions";
import { SectionHeader, StatusPill } from "@/features/workspaces/settings-ui";
import {
  CheckIcon,
  CodeDuotoneIcon,
  CopyIcon,
  DotsThreeVerticalIcon,
  KeyDuotoneIcon,
  PlusIcon,
  SpinnerIcon,
  WebhooksDuotoneIcon,
} from "@/components/ui/icons/phosphor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Human-readable labels for API scopes , raw scope strings surface in a tooltip. */
const SCOPE_LABELS: Record<string, string> = {
  "jobs:read": "Читать вакансии",
  "jobs:write": "Управление заданиями",
  "candidates:read": "Читать кандидатов",
  "candidates:write": "Управление кандидатами",
  "applications:read": "Чтение заявок",
  "applications:write": "Управление приложениями",
  "webhooks:manage": "Управление веб-перехватчиками",
};

function scopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope;
}

const MAX_VISIBLE_EVENTS = 2;

/** Mask an API key identifier for display , never the full raw secret. */
function maskKey(prefix: string, last4: string): string {
  return `${prefix}${"•".repeat(12)}${last4}`;
}

type WebhookDeliverySummary = {
  status: string;
  responseStatus: number | null;
  deliveredAt: string | null;
  createdAt: string;
} | null;

function deliveryLabel(delivery: WebhookDeliverySummary): string {
  if (!delivery) return "Поставок пока нет";
  const when = formatDistanceToNow(new Date(delivery.deliveredAt ?? delivery.createdAt), {
    addSuffix: true,
  });
  if (delivery.status === "success") return `Доставлено ${when}`;
  if (delivery.status === "pending") return "Ожидается доставка";
  const statusSuffix = delivery.responseStatus ? ` (${delivery.responseStatus})` : "";
  return `Доставка не удалась ${when}${statusSuffix}`;
}

type ApiKeyView = {
  id: string;
  name: string;
  type: string;
  environment: string;
  prefix: string;
  last4: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type WebhookView = {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  enabled: boolean;
  createdAt: string;
  lastDelivery: WebhookDeliverySummary;
};

type EventOption = { value: string; label: string };

export function DevelopersSettings(props: {
  canManage: boolean;
  appUrl: string;
  apiKeys: ApiKeyView[];
  webhooks: WebhookView[];
  scopes: string[];
  publishableScopes: string[];
  webhookEvents: EventOption[];
}) {
  return (
    <div className="space-y-6">
      <ApiKeysSection
        canManage={props.canManage}
        apiKeys={props.apiKeys}
        scopes={props.scopes}
        publishableScopes={props.publishableScopes}
      />
      <WebhooksSection
        canManage={props.canManage}
        webhooks={props.webhooks}
        events={props.webhookEvents}
      />
      <EmbedSection
        appUrl={props.appUrl}
        publishableKey={props.apiKeys.find(
          (k) => k.type === "publishable" && !k.revokedAt,
        )}
      />
    </div>
  );
}

function copy(value: string) {
  navigator.clipboard.writeText(value).then(
    () => toast.success("Скопировано"),
    () => toast.error("Не удалось скопировать"),
  );
}

/** Toggle chip used for scope/event multi-select. */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
        active
          ? "border-pine/40 bg-sage/50 text-sage-ink"
          : "bg-card text-muted-foreground hover:border-foreground/15 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyRow({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function SecretBanner({
  label,
  value,
  onDismiss,
}: {
  label: string;
  value: string;
  onDismiss: () => void;
}) {
  return (
    <div className="animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-pine/30 bg-sage/40 p-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
      <p className="font-medium text-sage-ink">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {"Скопируйте его сейчас. Вы больше не сможете его увидеть. "}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg bg-background px-2 py-1.5 font-mono text-xs">
          {value}
        </code>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 transition-transform active:scale-[0.97]"
          onClick={() => copy(value)}
        >
          <CopyIcon className="size-3.5" /> {"Копировать "}</Button>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 transition-transform active:scale-[0.97]"
          onClick={onDismiss}
        >
          {"Готово "}</Button>
      </div>
    </div>
  );
}

function ApiKeysSection({
  canManage,
  apiKeys,
  scopes,
  publishableScopes,
}: {
  canManage: boolean;
  apiKeys: ApiKeyView[];
  scopes: string[];
  publishableScopes: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"secret" | "publishable">("secret");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [created, setCreated] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const availableScopes = useMemo(
    () => (type === "publishable" ? publishableScopes : scopes),
    [type, scopes, publishableScopes],
  );

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  function submit() {
    if (!name.trim()) {
      toast.error("Назовите ключ.");
      return;
    }
    const scopesForType = selectedScopes.filter((s) =>
      availableScopes.includes(s),
    );
    if (scopesForType.length === 0) {
      toast.error("Выберите хотя бы одну область применения.");
      return;
    }
    startTransition(async () => {
      const result = await createApiKeyAction({
        name: name.trim(),
        type,
        scopes: scopesForType,
      });
      if (!result.ok || !result.raw) {
        toast.error(result.error ?? "Не удалось создать ключ.");
        return;
      }
      setCreated(result.raw);
      setName("");
      setSelectedScopes([]);
      setShowForm(false);
      router.refresh();
    });
  }

  function revoke(id: string) {
    setRevokingId(id);
    startTransition(async () => {
      const result = await revokeApiKeyAction(id);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось отозвать.");
        setRevokingId(null);
        return;
      }
      toast.success("Ключ отозван");
      router.refresh();
    });
  }

  return (
    <Card className="gap-5 p-6">
      <SectionHeader
        icon={KeyDuotoneIcon}
        title={"Ключи API"}
        description={"Секретные ключи для интеграции с сервером, публикуемые ключи для виджета встраивания."}
        action={
          canManage ? (
            <Button
              onClick={() => setShowForm((v) => !v)}
              className="transition-transform active:scale-[0.97]"
            >
              <PlusIcon className="size-4" /> {"Новый ключ "}</Button>
          ) : null
        }
      />

      {created && (
        <SecretBanner
          label={"Ваш новый ключ API"}
          value={created}
          onDismiss={() => setCreated(null)}
        />
      )}

      {showForm && canManage && (
        <div className="animate-in fade-in slide-in-from-top-1 space-y-4 rounded-2xl border bg-muted/20 p-4 duration-200">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{"Имя"}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={"Производственный сервер"}
              />
            </div>
             <div className="space-y-1.5">
              <Label>{"Тип"}</Label>
              <div className="flex gap-2">
                {(["secret", "publishable"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setType(t);
                      setSelectedScopes([]);
                    }}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      type === t
                        ? "border-pine bg-sage text-sage-ink"
                        : "text-muted-foreground hover:border-foreground/15",
                    )}
                  >
                    {t === "secret" ? "Секрет (ск)" : "Публикуемый (упак.)"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{"Области применения"}</Label>
            <div className="flex flex-wrap gap-1.5">
              {availableScopes.map((scope) => (
                <Chip
                  key={scope}
                  active={selectedScopes.includes(scope)}
                  onClick={() => toggleScope(scope)}
                >
                  <code className="font-mono">{scope}</code>
                </Chip>
              ))}
            </div>
          </div>
          <Button
            size="sm"
            onClick={submit}
            disabled={pending}
            className="transition-transform active:scale-[0.97]"
          >
            {pending && <SpinnerIcon className="size-4 animate-spin" />} {"Создать ключ "}</Button>
        </div>
      )}

      {apiKeys.length === 0 ? (
        <EmptyRow
          icon={KeyDuotoneIcon}
          title={"Ключей API пока нет"}
          description={"Создайте его для аутентификации межсерверных запросов или включения встроенного виджета."}
        />
      ) : (
        <div className="space-y-2">
          {apiKeys.map((key, i) => (
            <div
              key={key.id}
              className="animate-in fade-in slide-in-from-bottom-1 rounded-xl border bg-card px-4 py-3.5 transition-colors hover:border-foreground/15"
              style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{key.name}</span>
                    {key.revokedAt ? (
                      <Badge variant="danger">{"Отозван"}</Badge>
                    ) : (
                      <StatusPill tone={key.environment === "live" ? "on" : "warn"} dot={false}>
                        {key.environment === "live" ? "Живи" : "Тест"}
                      </StatusPill>
                    )}
                  </div>

                  <p className="mt-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {key.type === "secret" ? "Секретный ключ" : "Публикуемый ключ"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-muted/50 px-2.5 py-1.5 font-mono text-xs">
                      {maskKey(key.prefix, key.last4)}
                    </code>
                    <button
                      type="button"
                      onClick={() => copy(maskKey(key.prefix, key.last4))}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                    >
                      <CopyIcon className="size-3.5" /> {"Копировать "}</button>
                  </div>

                  {key.scopes.length > 0 && (
                    <div className="mt-2.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {"Разрешения "}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {key.scopes.map((scope, si) => (
                          <span key={scope} title={scope}>
                            {scopeLabel(scope)}
                            {si < key.scopes.length - 1 ? " · " : ""}
                          </span>
                        ))}
                      </p>
                    </div>
                  )}

                  <p className="mt-2.5 text-xs text-muted-foreground">
                    {"Создано "}{format(new Date(key.createdAt), "PP")}
                  </p>
                </div>

                {canManage && !key.revokedAt && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground"
                        aria-label={"Ключевые действия"}
                      >
                        <DotsThreeVerticalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={pending && revokingId === key.id}
                        onClick={() => revoke(key.id)}
                      >
                        {pending && revokingId === key.id && (
                          <SpinnerIcon className="size-3.5 animate-spin" />
                        )}
                        {"Отозвать ключ "}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function WebhooksSection({
  canManage,
  webhooks,
  events,
}: {
  canManage: boolean;
  webhooks: WebhookView[];
  events: EventOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WebhookView | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<WebhookView | null>(null);
  const [deliveries, setDeliveries] = useState<
    Array<{
      id: string;
      event: string;
      status: string;
      attempts: number;
      responseStatus: number | null;
      nextRetryAt: string | null;
      deliveredAt: string | null;
      createdAt: string;
    }>
  >([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  function rotateSecret(id: string) {
    setRotatingId(id);
    startTransition(async () => {
      const result = await rotateWebhookSecretAction(id);
      if (!result.ok || !result.secret) {
        toast.error(result.error ?? "Не удалось повернуть секрет.");
      } else {
        setSecret(result.secret);
        toast.success("Секрет подписи поменян");
      }
      setRotatingId(null);
      router.refresh();
    });
  }

  function openDeliveries(hook: WebhookView) {
    setDeliveriesFor(hook);
    setLoadingDeliveries(true);
    startTransition(async () => {
      const result = await listWebhookDeliveriesAction(hook.id);
      if (!result.ok || !result.deliveries) {
        toast.error(result.error ?? "Не удалось загрузить поставки.");
        setDeliveries([]);
      } else {
        setDeliveries(result.deliveries);
      }
      setLoadingDeliveries(false);
    });
  }

  function replayDelivery(deliveryId: string) {
    if (!deliveriesFor) return;
    setReplayingId(deliveryId);
    startTransition(async () => {
      const result = await replayWebhookDeliveryAction({
        endpointId: deliveriesFor.id,
        deliveryId,
      });
      if (!result.ok) toast.error(result.error ?? "Не удалось воспроизвести доставку.");
      else {
        toast.success("Повтор в очереди");
        openDeliveries(deliveriesFor);
      }
      setReplayingId(null);
      router.refresh();
    });
  }

  function toggleEditEvent(value: string) {
    setEditEvents((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function openEdit(hook: WebhookView) {
    setEditing(hook);
    setEditUrl(hook.url);
    setEditDescription(hook.description ?? "");
    setEditEvents(hook.events);
  }

  function saveEdit() {
    if (!editing) return;
    if (!/^https?:\/\//.test(editUrl)) {
      toast.error("Введите действительный URL-адрес http(s).");
      return;
    }
    if (editEvents.length === 0) {
      toast.error("Подпишитесь хотя бы на одно событие.");
      return;
    }
    startTransition(async () => {
      const result = await updateWebhookAction({
        id: editing.id,
        url: editUrl,
        events: editEvents,
        description: editDescription || null,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить вебхук.");
        return;
      }
      toast.success("Вебхук обновлен");
      setEditing(null);
      router.refresh();
    });
  }

  function toggleEvent(value: string) {
    setSelectedEvents((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function submit() {
    if (!/^https?:\/\//.test(url)) {
      toast.error("Введите действительный URL-адрес http(s).");
      return;
    }
    if (selectedEvents.length === 0) {
      toast.error("Подпишитесь хотя бы на одно событие.");
      return;
    }
    startTransition(async () => {
      const result = await createWebhookAction({
        url,
        events: selectedEvents,
        description: description || undefined,
      });
      if (!result.ok || !result.secret) {
        toast.error(result.error ?? "Не удалось создать вебхук.");
        return;
      }
      setSecret(result.secret);
      setUrl("");
      setDescription("");
      setSelectedEvents([]);
      setShowForm(false);
      router.refresh();
    });
  }

  function toggleEnabled(id: string, enabled: boolean) {
    startTransition(async () => {
      const result = await updateWebhookAction({ id, enabled });
      if (!result.ok) toast.error(result.error ?? "Не удалось обновить.");
      else router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteWebhookAction(id);
      if (!result.ok) toast.error(result.error ?? "Не удалось удалить.");
      else {
        toast.success("Вебхук удален.");
        router.refresh();
      }
    });
  }

  function test(id: string) {
    setTestingId(id);
    startTransition(async () => {
      const result = await testWebhookAction(id);
      if (result.ok) toast.success("Тест пройден");
      else toast.error(result.error ?? `Тест не пройден (${result.status ?? "?"})`);
      setTestingId(null);
      router.refresh();
    });
  }

  return (
    <Card className="gap-5 p-6">
      <SectionHeader
        icon={WebhooksDuotoneIcon}
        title={"Вебхуки"}
        description={"Получайте подписанные события при изменении приложений и заданий."}
        action={
          canManage ? (
            <Button
              onClick={() => setShowForm((v) => !v)}
              className="transition-transform active:scale-[0.97]"
            >
              <PlusIcon className="size-4" /> {"Добавить конечную точку "}</Button>
          ) : null
        }
      />

      {secret && (
        <SecretBanner
          label={"Секрет подписания"}
          value={secret}
          onDismiss={() => setSecret(null)}
        />
      )}

      {showForm && canManage && (
        <div className="animate-in fade-in slide-in-from-top-1 space-y-4 rounded-2xl border bg-muted/20 p-4 duration-200">
          <div className="space-y-1.5">
            <Label>{"URL-адрес конечной точки"}</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/harly"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{"Описание (необязательно)"}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"например Slack-уведомитель"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{"События"}</Label>
            <div className="flex flex-wrap gap-1.5">
              {events.map((event) => (
                <Chip
                  key={event.value}
                  active={selectedEvents.includes(event.value)}
                  onClick={() => toggleEvent(event.value)}
                >
                  {event.label}
                </Chip>
              ))}
            </div>
          </div>
          <Button
            size="sm"
            onClick={submit}
            disabled={pending}
            className="transition-transform active:scale-[0.97]"
          >
            {pending && <SpinnerIcon className="size-4 animate-spin" />} {"Создать конечную точку "}</Button>
        </div>
      )}

      {webhooks.length === 0 ? (
        <EmptyRow
          icon={WebhooksDuotoneIcon}
          title={"Конечных точек вебхука пока нет."}
          description={"Добавьте его, чтобы получать подписанные события при изменении приложений и заданий."}
        />
      ) : (
        <div className="space-y-2">
          {webhooks.map((hook, i) => {
            const eventLabelOf = (value: string) =>
              events.find((e) => e.value === value)?.label ?? value;
            const visibleEvents = hook.events.slice(0, MAX_VISIBLE_EVENTS);
            const overflowCount = hook.events.length - visibleEvents.length;

            return (
              <div
                key={hook.id}
                className="animate-in fade-in slide-in-from-bottom-1 rounded-xl border bg-card px-4 py-3.5 transition-colors hover:border-foreground/15"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-mono text-sm font-medium">{hook.url}</p>
                      <StatusPill tone={hook.enabled ? "on" : "off"}>
                        {hook.enabled ? "Активные" : "Неактивный"}
                      </StatusPill>
                    </div>
                    {hook.description && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {hook.description}
                      </p>
                    )}

                    <p className="mt-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {"Подписанные события "}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                      {visibleEvents.map((event, ei) => (
                        <span key={event} title={event}>
                          {eventLabelOf(event)}
                          {ei < visibleEvents.length - 1 ? " ·" : ""}
                        </span>
                      ))}
                      {overflowCount > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="rounded-md px-1.5 py-0.5 font-medium text-pine transition-colors hover:bg-sage/40"
                            >
                              +{overflowCount} {"ещё "}</button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-64 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {"Все подписанные события "}</p>
                            <div className="mt-2 space-y-1">
                              {hook.events.map((event) => (
                                <p key={event} title={event} className="text-sm">
                                  {eventLabelOf(event)}
                                </p>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    <p className="mt-2.5 text-xs text-muted-foreground">
                      {deliveryLabel(hook.lastDelivery)}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => test(hook.id)}
                        disabled={pending}
                      >
                        {pending && testingId === hook.id && (
                          <SpinnerIcon className="size-3.5 animate-spin" />
                        )}
                        {"Отправить тест "}</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDeliveries(hook)}
                      >
                        {"Поставки "}</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground"
                            aria-label={"Действия вебхука"}
                          >
                            <DotsThreeVerticalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(hook)}>
                            {"Изменить конечную точку "}</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => rotateSecret(hook.id)}
                            disabled={pending && rotatingId === hook.id}
                          >
                            {"Ротация секрета подписи "}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleEnabled(hook.id, !hook.enabled)}>
                            {hook.enabled ? "Отключить конечную точку" : "Включить конечную точку"}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => remove(hook.id)}>
                            {"Удалить конечную точку "}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{"Изменить конечную точку"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{"URL-адрес конечной точки"}</Label>
              <Input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://example.com/webhooks/harly"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{"Описание (необязательно)"}</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={"например Slack-уведомитель"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{"События"}</Label>
              <div className="flex flex-wrap gap-1.5">
                {events.map((event) => (
                  <Chip
                    key={event.value}
                    active={editEvents.includes(event.value)}
                    onClick={() => toggleEditEvent(event.value)}
                  >
                    {event.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>
              {"Отмена "}</Button>
            <Button onClick={saveEdit} disabled={pending}>
              {pending && <SpinnerIcon className="size-4 animate-spin" />} {"Сохранить изменения "}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deliveriesFor !== null}
        onOpenChange={(open) => !open && setDeliveriesFor(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{"История доставки"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {loadingDeliveries ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {"Загрузка… "}</p>
            ) : deliveries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {"Поставок пока нет "}</p>
            ) : (
              deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs">{delivery.event}</span>
                      <StatusPill tone={delivery.status === "success" ? "on" : "off"}>
                        {delivery.status}
                      </StatusPill>
                      {delivery.responseStatus !== null && (
                        <span className="text-xs text-muted-foreground">
                          {delivery.responseStatus}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(delivery.deliveredAt ?? delivery.createdAt), {
                        addSuffix: true,
                      })}
                      {delivery.attempts > 1 ? ` · ${delivery.attempts} попыток` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending && replayingId === delivery.id}
                    onClick={() => replayDelivery(delivery.id)}
                  >
                    {pending && replayingId === delivery.id && (
                      <SpinnerIcon className="size-3.5 animate-spin" />
                    )}
                    {"Повтор "}</Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveriesFor(null)}>
              {"Закрыть "}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EmbedSection({
  appUrl,
  publishableKey,
}: {
  appUrl: string;
  publishableKey?: ApiKeyView;
}) {
  const [copied, setCopied] = useState(false);
  const [variant, setVariant] = useState<
    "board" | "job" | "html" | "react"
  >("board");

  const pkAttr = publishableKey
    ? `\n  data-pk="${publishableKey.prefix}…"`
    : "";

  const snippets: Record<
    "board" | "job" | "html" | "react",
    { label: string; lang: string; code: string; note: string }
  > = {
    board: {
      label: "Доска объявлений",
      lang: "HTML",
      note: "Отображает открытые роли с помощью встроенного применения. Бросай куда угодно.",
      code: `<div id="harly-jobs-container"></div>
<script
  src="${appUrl}/embed/widget.js"
  ${pkAttr.trim()}
  data-theme="auto"
  defer
></script>`,
    },
    job: {
      label: "Одиночная работа",
      lang: "HTML",
      note: "Встраивайте форму заявки только для одной роли на отдельную страницу. Установите data-job в пул задания.",
      code: `<div id="harly-jobs-container"></div>
<script
  src="${appUrl}/embed/widget.js"
  ${pkAttr.trim()}
  data-job="your-job-slug"
  data-theme="auto"
  defer
></script>`,
    },
    html: {
      label: "Пользовательская форма",
      lang: "HTML",
      note: "Загружает вопросы по этому заданию, визуализирует их и отправляет полную заявку.",
      code: `<form id="harly-apply">
  <label>First name <input name="firstName" required /></label>
  <label>Last name <input name="lastName" required /></label>
  <label>Email <input name="email" type="email" required /></label>
  <div id="harly-questions"></div>
  <button type="submit">Apply</button>
</form>
<script>
  const jobApi = "${appUrl}/api/public/v1/jobs/your-job-slug";
  const form = document.getElementById("harly-apply");
  const questions = document.getElementById("harly-questions");

  fetch(jobApi)
    .then((r) => r.json())
    .then(({ data }) => {
      (data.applicationConfig?.questions || []).forEach((q) => {
        const label = document.createElement("label");
        label.textContent = q.label + (q.required ? " *" : "");
        let input = document.createElement(q.type === "textarea" ? "textarea" : "input");
        if (q.type === "select") {
          input = document.createElement("select");
          (q.options || []).forEach((option) => input.add(new Option(option, option)));
        }
        input.dataset.questionId = q.id;
        input.required = q.required;
        if (q.placeholder) input.placeholder = q.placeholder;
        label.appendChild(input);
        questions.appendChild(label);
      });
    });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    body.questionAnswers = Object.fromEntries(
      [...questions.querySelectorAll("[data-question-id]")].map((input) => [
        input.dataset.questionId,
        input.value,
      ])
    );
    const response = await fetch(jobApi + "/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("Application failed");
    form.innerHTML = "<p>Application received. Thank you!</p>";
  });
</script>`,
    },
    react: {
      label: "Реагировать",
      lang: "TSX",
      note: "Типизированный обработчик, который можно подключить к своему компоненту.",
      code: `async function submitApplication(values: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  const res = await fetch(
    "${appUrl}/api/public/v1/jobs/your-job-slug/applications",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }
  );
  if (!res.ok) throw new Error("Application failed");
  return res.json();
}`,
    },
  };

  const active = snippets[variant];

  function handleCopy() {
    copy(active.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="gap-5 p-6">
      <SectionHeader
        icon={CodeDuotoneIcon}
        title={"Встроить виджет"}
        description={"Добавьте свои открытые вакансии на любую страницу вакансий. Виджет наследует шрифты и цвета вашего сайта, и вы можете дополнительно оформить его с помощью переменных CSS."}
      />

      <div className="flex flex-wrap gap-1.5">
        {(
          Object.entries(snippets) as Array<
            [typeof variant, (typeof snippets)[typeof variant]]
          >
        ).map(([key, s]) => (
          <Chip
            key={key}
            active={variant === key}
            onClick={() => setVariant(key)}
          >
            {s.label}
          </Chip>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{active.note}</p>

      <div className="overflow-hidden rounded-2xl border bg-muted/30">
        <div className="flex items-center justify-between border-b bg-muted/60 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-destructive/40" />
              <span className="size-2.5 rounded-full bg-clay/40" />
              <span className="size-2.5 rounded-full bg-pine/40" />
            </span>
            <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {active.lang}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95"
          >
            {copied ? (
              <>
                <CheckIcon className="size-3.5 text-pine" /> {"Скопировано "}</>
            ) : (
              <>
                <CopyIcon className="size-3.5" /> {"Копировать "}</>
            )}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
          <code>{active.code}</code>
        </pre>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
        <p className="mb-1.5 font-medium text-foreground">{"Тематика"}</p>
        <p>
          {"Виджет выделяет акцент на фирменном цвете вашей доски, а затем переходит на главную страницу. Переопределите любой токен из вашей собственной таблицы стилей: "}</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-3 font-mono">
          <code>{`.oh-root {
  --oh-accent: #5b5bd6;
  --oh-radius: 10px;
  --oh-border: #2a2a2a;
}`}</code>
        </pre>
        <p className="mt-2">
          {"Или прикрепите схему с"}{" "}
          <code className="font-mono">data-theme=&quot;light|dark&quot;</code>.
        </p>
      </div>

      {publishableKey ? (
        <p className="text-xs text-muted-foreground">
          {"Заменить маскируемый "}<code className="font-mono">data-pk</code> {"с вашим полным публикуемым ключом. "}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {"Создайте опубликованный ключ выше для встроенной аналитики и отзыва (необязательно. Виджет также работает только с фрагментом рабочей области). "}</p>
      )}
    </Card>
  );
}
