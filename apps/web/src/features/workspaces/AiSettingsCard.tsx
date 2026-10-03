"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import {
  disableAiAction,
  saveAiSettingsAction,
  saveAiAutoScoreAction,
  saveAiDuplicateCheckAction,
  saveAiResumeAnonymizationAction,
  searchOpenRouterModelsAction,
  testAiConnectionAction,
} from "@/features/workspaces/ai-settings-actions";
import {
  AI_PROVIDERS,
  formatModelLabel,
  getProvider,
  type AiProviderId,
  type OpenRouterModel,
} from "@/lib/ai/providers";
import type { WorkspaceAiStatus } from "@/lib/ai/config";
import {
  BrandTile,
  SectionHeader,
  StatCell,
  StatusPill,
} from "@/features/workspaces/settings-ui";
import { DrawerLayout } from "@/features/candidates/DrawerLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ClaudeLogo,
  GeminiLogo,
  OpenAiLogo,
  OpenRouterLogo,
  XaiLogo,
} from "@/components/ui/icons/brands";
import {
  CheckIcon,
  EyeSlashDuotoneIcon,
  GlobeIcon,
  KeyDuotoneIcon,
  LightningIcon,
  MagicWandDuotoneIcon,
  ReadCvDuotoneIcon,
  RobotDuotoneIcon,
  SearchIcon,
  SpinnerIcon,
  UsersThreeDuotoneIcon,
} from "@/components/ui/icons/phosphor";
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
import { cn } from "@/lib/utils";

const PROVIDER_LOGO: Record<
  AiProviderId,
  React.ComponentType<{ className?: string }>
> = {
  openai: OpenAiLogo,
  anthropic: ClaudeLogo,
  google: GeminiLogo,
  xai: XaiLogo,
  openrouter: OpenRouterLogo,
};

function providerLabel(id: string | null) {
  return id ? (getProvider(id)?.label ?? id) : null;
}

export function AiSettingsCard({
  status,
  canEdit,
}: {
  status: WorkspaceAiStatus;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [togglePending, startToggle] = useTransition();

  const ActiveLogo = status.provider
    ? (PROVIDER_LOGO[status.provider as AiProviderId] ?? null)
    : null;

  function toggleEnabled(next: boolean) {
    if (!status.hasApiKey && next) {
      toast.error("Сначала настройте поставщика и ключ API.");
      return;
    }
    startToggle(async () => {
      const result = next
        ? await saveAiSettingsAction({
            provider: status.provider ?? "openai",
            modelId: status.modelId ?? "",
            enabled: true,
          })
        : await disableAiAction();
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить настройки AI.");
        return;
      }
      toast.success(next ? "ИИ включен" : "ИИ отключен");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {!status.encryptionReady ? <EncryptionWarning /> : null}

      {/* Provider config card */}
      <Card className="gap-0 overflow-hidden p-0">
        <div className="p-6">
          <SectionHeader
            icon={RobotDuotoneIcon}
            title={"ИИ"}
            badge={
              status.hasApiKey ? (
                <StatusPill tone={status.enabled ? "on" : "off"}>
                  {status.enabled ? "Активные" : "Приостановлено"}
                </StatusPill>
              ) : (
                <StatusPill tone="neutral">{"Использование эвристики"}</StatusPill>
              )
            }
            description={"Используйте свой собственный ключ поставщика услуг для анализа резюме и составления описания вакансии. Без него Харли возвращается к быстрым встроенным эвристикам."}
            action={
              canEdit ? (
                <>
                  {status.encryptionReady ? (
                    <Button
                      asChild
                      variant={status.hasApiKey ? "outline" : "default"}
                    >
                      <Link href={"/settings/ai/configure" as Route}>
                        <KeyDuotoneIcon className="size-4" />
                        {status.hasApiKey ? "Управление" : "Настройка ИИ"}
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="default" disabled>
                      <KeyDuotoneIcon className="size-4" />
                      {"Настройка ИИ "}</Button>
                  )}
                  {status.hasApiKey ? (
                    <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                      <Switch
                        checked={status.enabled}
                        disabled={togglePending}
                        onCheckedChange={toggleEnabled}
                        aria-label={"Включить ИИ"}
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

          {status.hasApiKey ? (
            <div className="mt-4 grid grid-cols-1 divide-y border-t bg-muted/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <StatCell label={"Поставщик"}>
                {ActiveLogo ? <ActiveLogo className="size-4" /> : null}
                {providerLabel(status.provider)}
              </StatCell>
              <StatCell label={"Модель"}>
                <span className="truncate font-mono text-[13px]">
                  {status.modelId
                    ? formatModelLabel(status.modelId)
                    : "Не настроено"}
                </span>
              </StatCell>
              <StatCell label={"Конечная точка"}>
                <span className="truncate text-muted-foreground">
                  {status.baseUrl ?? "Поставщик по умолчанию"}
                </span>
              </StatCell>
            </div>
          ) : null}
        </div>
      </Card>

      {/* AI Features section */}
      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground/80">
          {"Возможности искусственного интеллекта "}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={ReadCvDuotoneIcon}
            title={"Возобновить парсинг"}
            description={"Автоматически извлекайте имя, контакты, навыки и историю работы из загруженных резюме в структурированные профили кандидатов при подаче заявки."}
            alwaysOn
          />
          <FeatureCard
            icon={MagicWandDuotoneIcon}
            title={"Составление должностной инструкции"}
            description={"Создавайте первые черновики публикаций из краткого описания в мастере вакансий. Должности, ключевых слов и типа рабочего места достаточно, чтобы получить полный черновик."}
            alwaysOn
          />
          <AutoScoreFeatureCard status={status} canEdit={canEdit} />
          <DuplicateCheckFeatureCard status={status} canEdit={canEdit} />
          <ResumeAnonymizationFeatureCard status={status} canEdit={canEdit} />
        </div>
      </div>

      {/* Supported providers */}
      <Card className="gap-4">
        <div className="px-6">
          <h3 className="text-sm font-semibold tracking-tight">
            {"Работает с вашим провайдером "}</h3>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {"Возьмите с собой ключ от любого крупного провайдера или направьте через OpenRouter сотни моделей, включая бесплатные. Ключи шифруются в состоянии покоя. "}</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 px-6 sm:grid-cols-3 lg:grid-cols-5">
          {AI_PROVIDERS.map((provider) => {
            const Logo = PROVIDER_LOGO[provider.id];
            const isActive =
              status.provider === provider.id && status.hasApiKey;
            return (
              <div
                key={provider.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                  isActive
                    ? "border-pine/40 bg-sage/40"
                    : "bg-card hover:border-foreground/15",
                )}
              >
                <BrandTile className="size-8 rounded-lg">
                  <Logo className="size-4" />
                </BrandTile>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {provider.label}
                  </span>
                  {isActive ? (
                    <span className="block text-[11px] font-medium text-pine">
                      {"Подключено "}</span>
                  ) : provider.supportsModelSearch ? (
                    <span className="block text-[11px] text-muted-foreground">
                      {"сотни моделей "}</span>
                  ) : (
                    <span className="block text-[11px] text-muted-foreground">
                      {provider.models.length} {"моделей "}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function EncryptionWarning() {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
      <GlobeIcon className="mt-0.5 size-4 shrink-0" />
      <p>
        {"Установить "}<code className="font-mono text-xs">AI_ENCRYPTION_KEY</code> {"на сервере, чтобы включить функции ИИ. "}</p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  alwaysOn = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  alwaysOn?: boolean;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-foreground/80">
          <Icon className="size-5" />
        </span>
        {alwaysOn ? (
          <span className="mt-0.5 rounded-full bg-sage/60 px-2 py-0.5 text-[11px] font-semibold text-pine">
            {"Всегда включен "}</span>
        ) : null}
      </div>
      <h3 className="mt-3.5 text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}

function AutoScoreFeatureCard({
  status,
  canEdit,
}: {
  status: WorkspaceAiStatus;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startToggle] = useTransition();
  const [optimistic, setOptimistic] = useState(status.autoScore);

  const disabled = !status.enabled || !status.hasApiKey || !canEdit;

  function toggle(next: boolean) {
    setOptimistic(next);
    startToggle(async () => {
      const result = await saveAiAutoScoreAction(next);
      if (!result.ok) {
        setOptimistic(!next);
        toast.error(result.error ?? "Не удалось обновить настройку.");
        return;
      }
      toast.success(next ? "Автоматическая оценка включена" : "Автоматическая оценка отключена");
      router.refresh();
    });
  }

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-foreground/80">
          <LightningIcon className="size-5" />
        </span>
        <Switch
          checked={optimistic}
          onCheckedChange={toggle}
          disabled={disabled || pending}
          aria-label={"Заявки на автооценку"}
          className="mt-0.5"
        />
      </div>
      <h3 className="mt-3.5 text-sm font-semibold tracking-tight">
        {"Заявки на автооценку "}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {"Автоматически оценивайте каждое новое приложение по мере его поступления. Ручной триггер не требуется. Требуется включение ИИ. "}</p>
      {disabled && status.hasApiKey && !status.enabled ? (
        <p className="mt-2 text-xs text-clay">{"Включите AI выше, чтобы активировать."}</p>
      ) : null}
      {!status.hasApiKey ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {"Настройте провайдера для разблокировки. "}</p>
      ) : null}
    </Card>
  );
}

function DuplicateCheckFeatureCard({
  status,
  canEdit,
}: {
  status: WorkspaceAiStatus;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startToggle] = useTransition();
  const [optimistic, setOptimistic] = useState(status.duplicateCheck);

  const disabled = !status.enabled || !status.hasApiKey || !canEdit;

  function toggle(next: boolean) {
    setOptimistic(next);
    startToggle(async () => {
      const result = await saveAiDuplicateCheckAction(next);
      if (!result.ok) {
        setOptimistic(!next);
        toast.error(result.error ?? "Не удалось обновить настройку.");
        return;
      }
      toast.success(
        next ? "Обнаружение дубликатов включено" : "Обнаружение дубликатов отключено",
      );
      router.refresh();
    });
  }

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-foreground/80">
          <UsersThreeDuotoneIcon className="size-5" />
        </span>
        <Switch
          checked={optimistic}
          onCheckedChange={toggle}
          disabled={disabled || pending}
          aria-label={"Обнаружение дубликатов"}
          className="mt-0.5"
        />
      </div>
      <h3 className="mt-3.5 text-sm font-semibold tracking-tight">
        {"Обнаружение дубликатов "}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {"Автоматически отмечайте потенциальных повторяющихся кандидатов при поступлении нового заявления и позволяйте проверять их с помощью ИИ из любого профиля кандидата. "}</p>
      {disabled && status.hasApiKey && !status.enabled ? (
        <p className="mt-2 text-xs text-clay">{"Включите AI выше, чтобы активировать."}</p>
      ) : null}
      {!status.hasApiKey ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {"Настройте провайдера для разблокировки. "}</p>
      ) : null}
    </Card>
  );
}

function ResumeAnonymizationFeatureCard({
  status,
  canEdit,
}: {
  status: WorkspaceAiStatus;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startToggle] = useTransition();
  const [optimistic, setOptimistic] = useState(status.resumeAnonymization);

  // Redaction is deterministic (no model call), so it only needs edit rights ,
  // not an enabled provider like the model-backed features above.
  const disabled = !canEdit;

  function toggle(next: boolean) {
    setOptimistic(next);
    startToggle(async () => {
      const result = await saveAiResumeAnonymizationAction(next);
      if (!result.ok) {
        setOptimistic(!next);
        toast.error(result.error ?? "Не удалось обновить настройку.");
        return;
      }
      toast.success(
        next ? "Возобновить анонимизацию включена" : "Анонимизация возобновления отключена",
      );
      router.refresh();
    });
  }

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-foreground/80">
          <EyeSlashDuotoneIcon className="size-5" />
        </span>
        <Switch
          checked={optimistic}
          onCheckedChange={toggle}
          disabled={disabled || pending}
          aria-label={"Возобновить анонимизацию"}
          className="mt-0.5"
        />
      </div>
      <h3 className="mt-3.5 text-sm font-semibold tracking-tight">
        {"Возобновить анонимизацию "}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {"Скрывайте имена, контакты и ссылки в профилях кандидатов во время проверки, чтобы ранний отбор основывался на навыках и опыте, а не на личности. Рецензенты могут раскрывать данные по каждому кандидату. "}</p>
    </Card>
  );
}

export function AiSettingsForm({ status }: { status: WorkspaceAiStatus }) {
  const router = useRouter();
  const initialProvider = (status.provider as AiProviderId) ?? "openai";
  const [provider, setProvider] = useState<AiProviderId>(initialProvider);
  const [modelId, setModelId] = useState<string>(status.modelId ?? "");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(status.enabled || !status.hasApiKey);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OpenRouterModel[]>([]);
  const [searching, startSearch] = useTransition();
  const [testing, startTest] = useTransition();
  const [saving, startSave] = useTransition();
  // Inline test-connection result so success reads clearly (not just a toast).
  const [testResult, setTestResult] = useState<
    | { state: "ok"; model: string }
    | { state: "error"; message: string }
    | null
  >(null);

  const info = getProvider(provider);

  const [customEndpoint, setCustomEndpoint] = useState(status.baseUrl ?? "");
  const [showCustomEndpoint, setShowCustomEndpoint] = useState(
    Boolean(status.baseUrl && status.baseUrl !== info?.baseUrl),
  );
  const isOpenRouter = info?.supportsModelSearch ?? false;
  const displayBaseUrl =
    showCustomEndpoint && customEndpoint
      ? customEndpoint
      : (info?.baseUrl ?? "");

  function changeProvider(next: string) {
    const id = next as AiProviderId;
    setProvider(id);
    const nextInfo = getProvider(id);
    setModelId(nextInfo?.models[0]?.id ?? "");
    setResults([]);
    setQuery("");
    setTestResult(null);
    if (!showCustomEndpoint) {
      setCustomEndpoint(nextInfo?.baseUrl ?? "");
    }
  }

  function runSearch() {
    startSearch(async () => {
      const found = await searchOpenRouterModelsAction(query);
      setResults(found);
      if (found.length === 0) {
        toast.message("Модели не найдены", {
          description: "Попробуйте другой термин.",
        });
      }
    });
  }

  function runTest() {
    setTestResult(null);
    startTest(async () => {
      const result = await testAiConnectionAction({
        provider,
        modelId,
        apiKey: apiKey || undefined,
        baseUrl:
          showCustomEndpoint && customEndpoint ? customEndpoint : undefined,
      });
      if (result.ok) {
        setTestResult({ state: "ok", model: modelId });
        toast.success("Соединение в порядке");
      } else {
        setTestResult({
          state: "error",
          message: result.error ?? "Соединение не удалось.",
        });
        toast.error(result.error ?? "Соединение не удалось.");
      }
    });
  }

  function save() {
    startSave(async () => {
      const result = await saveAiSettingsAction({
        provider,
        modelId,
        apiKey: apiKey || undefined,
        baseUrl:
          showCustomEndpoint && customEndpoint ? customEndpoint : undefined,
        enabled,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить.");
        return;
      }
      toast.success("Настройки ИИ сохранены.");
      // Guide the user back to the AI settings overview instead of leaving
      // them on the same form (which reads as "nothing happened").
      router.push("/settings/ai" as Route);
      router.refresh();
    });
  }

  return (
    <DrawerLayout
      title={"Настройка ИИ"}
      description={"Ваш ключ API зашифрован и никогда больше не отображается."}
      surface="page"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>{"Поставщик"}</Label>
          <Select value={provider} onValueChange={changeProvider}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {provider ? (
                  <span className="flex items-center gap-2">
                    {(() => {
                      const Logo = PROVIDER_LOGO[provider];
                      return Logo ? <Logo className="size-4 shrink-0" /> : null;
                    })()}
                    {getProvider(provider)?.label ?? provider}
                  </span>
                ) : (
                  "Выберите провайдера"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map((option) => {
                const Logo = PROVIDER_LOGO[option.id];
                return (
                  <SelectItem key={option.id} value={option.id}>
                    <span className="flex items-center gap-2">
                      <Logo className="size-4 shrink-0" />
                      {option.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-model">{"Модель"}</Label>
          <Input
            id="ai-model"
            value={modelId}
            onChange={(event) => {
              setModelId(event.target.value);
              setTestResult(null);
            }}
            placeholder={
              isOpenRouter
                ? "например опенай/gpt-4o"
                : "Выберите или введите любой идентификатор модели"
            }
            className="font-mono text-sm"
          />
          {isOpenRouter ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={"Поиск моделей OpenRouter (в том числе бесплатных)…"}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      runSearch();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={runSearch}
                  disabled={searching}
                >
                  {searching ? (
                    <SpinnerIcon className="size-4" />
                  ) : (
                    <SearchIcon className="size-4" />
                  )}
                </Button>
              </div>
              {results.length > 0 ? (
                <div className="max-h-52 overflow-y-auto rounded-lg border">
                  {results.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        setModelId(model.id);
                        setTestResult(null);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60",
                        model.id === modelId && "bg-sage/40",
                      )}
                    >
                      <span className="truncate">
                        <span className="font-medium">{model.name}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {model.id}
                        </span>
                      </span>
                      {model.free ? (
                        <Badge className="bg-sage text-sage-ink">{"Бесплатно"}</Badge>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {info?.models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    setModelId(model.id);
                    setTestResult(null);
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition hover:bg-muted",
                    model.id === modelId
                      ? "border-pine bg-sage text-sage-ink"
                      : "text-muted-foreground",
                  )}
                >
                  {model.label}
                </button>
              ))}
            </div>
          )}
          {!isOpenRouter ? (
            <p className="text-xs text-muted-foreground">
              {"Выберите предложенную модель или введите любой идентификатор модели, поддерживаемый поставщиком. "}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-key">{"API-ключ"}</Label>
          <Input
            id="ai-key"
            type="password"
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              setTestResult(null);
            }}
            placeholder={
              status.hasApiKey
                ? "•••••••• (сохранено, оставьте пустым, чтобы сохранить)"
                : "Вставьте свой ключ API"
            }
            autoComplete="off"
          />
          {info ? (
            <p className="text-xs text-muted-foreground">
              {info.apiKeyHint}{" "}
              <a
                href={info.apiKeyUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline underline-offset-2 hover:text-pine"
              >
                {"Получить ключ "}</a>
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowCustomEndpoint(!showCustomEndpoint)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <GlobeIcon className="size-3.5" />
            {showCustomEndpoint
              ? "Использовать конечную точку по умолчанию"
              : "Конечная точка пользовательского API"}
          </button>
          {showCustomEndpoint ? (
            <Input
              value={customEndpoint}
              onChange={(event) => {
                setCustomEndpoint(event.target.value);
                setTestResult(null);
              }}
              placeholder={info?.baseUrl ?? "https://api.openai.com/v1"}
              className="font-mono text-sm"
            />
          ) : (
            <p className="rounded-lg bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
              {displayBaseUrl}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">{"Включить ИИ"}</p>
            <p className="text-xs text-muted-foreground">
              {"Когда параметр выключен, Харли использует только эвристику. "}</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {/* Test connection + inline result. Success is a clear green banner,
            not just a transient toast. */}
        <div className="space-y-2.5">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={runTest}
            disabled={testing || !modelId.trim()}
          >
            {testing ? (
              <SpinnerIcon className="size-4" />
            ) : (
              <LightningIcon className="size-4" />
            )}
            {"Тестовое соединение "}</Button>
          {testResult?.state === "ok" ? (
            <div className="flex items-start gap-2 rounded-xl border border-pine/20 bg-sage/30 px-3 py-2.5 text-sm text-pine">
              <CheckIcon className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-medium">{"Соединение исправно."}</span>{" "}
                <span className="text-pine/80">
                  {providerLabel(provider)} {"ответил с"}{" "}
                  <span className="font-mono text-[13px]">
                    {testResult.model}
                  </span>
                  .
                </span>
              </p>
            </div>
          ) : testResult?.state === "error" ? (
            <div className="flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/5 px-3 py-2.5 text-sm text-clay">
              <GlobeIcon className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-medium">{"Не удалось подключиться."}</span>{" "}
                {testResult.message}
              </p>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {"Перед сохранением проверьте свой ключ и модель. "}</p>
          )}
        </div>

        {/* Save is inline at the end — scroll to it, no floating bar. */}
        <div className="flex items-center justify-end gap-2 border-t pt-5">
          <Button asChild variant="ghost">
            <Link href={"/settings/ai" as Route}>{"Отмена"}</Link>
          </Button>
          <Button onClick={save} disabled={saving || !modelId.trim()}>
            {saving ? <SpinnerIcon className="size-4" /> : null}
            {"Сохранить изменения "}</Button>
        </div>
      </div>
    </DrawerLayout>
  );
}
