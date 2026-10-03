"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import {
  LEGAL_PAGE_LABELS,
} from "@/features/workspaces/legal-constants";
import {
  saveLegalSettingsAction,
  type LegalPageKey,
  type LegalPages,
  type LegalSettingsData,
} from "@/features/workspaces/legal-settings-actions";
import {
  getTemplate,
  type Jurisdiction,
} from "@/features/workspaces/legal-templates";
import { renderMarkdown, toHtml } from "@/features/legal/render-markdown";
import {
  SpinnerIcon,
  SealCheckDuotoneIcon,
} from "@/components/ui/icons/phosphor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const JURISDICTION_LABELS: Record<string, string> = {
  eu: "Европейский Союз (ВВП)",
  us: "Соединенные Штаты",
  cl: "Чили (21,719 Лей)",
  br: "Бразилия (LGPD)",
  other: "Другое",
};

const PAGE_KEYS: LegalPageKey[] = [
  "privacyPolicy",
  "termsOfService",
  "cookiePolicy",
  "candidateNotice",
  "aiTransparencyNotice",
];

const DRAFT_KEY = "harly-legal-draft";

function loadDraft(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      normalized[key] = typeof value === "string" ? toHtml(value) : "";
    }
    return normalized;
  } catch {
    return null;
  }
}

function saveDraft(data: Record<string, string>) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded or private browsing , silently ignore
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function pagesToDraft(pages: LegalPages): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const [key, value] of Object.entries(pages)) {
    draft[key] = typeof value === "string" ? toHtml(value) : "";
  }
  return draft;
}

export function LegalSettings({
  settings,
}: {
  settings: LegalSettingsData;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();

  // Entity info
  const [entityName, setEntityName] = useState(settings.legalEntityName ?? "");
  const [entityAddress, setEntityAddress] = useState(settings.legalEntityAddress ?? "");
  const [entityEmail, setEntityEmail] = useState(settings.legalEntityEmail ?? "");
  const [entityWebsite, setEntityWebsite] = useState(settings.legalEntityWebsite ?? "");
  const [jurisdiction, setJurisdiction] = useState(settings.legalJurisdiction ?? "");
  const [dpoEmail, setDpoEmail] = useState(settings.dpoEmail ?? "");
  const [retentionApplicants, setRetentionApplicants] = useState(settings.dataRetentionApplicantsMonths);
  const [retentionTalentPool, setRetentionTalentPool] = useState(settings.dataRetentionTalentPoolMonths);
  const [retentionEnabled, setRetentionEnabled] = useState(settings.dataRetentionEnabled);
  const [auditRetentionMonths, setAuditRetentionMonths] = useState(settings.auditLogRetentionMonths);
  const [consentText, setConsentText] = useState(settings.consentCheckboxText ?? "");

  // Legal pages , initialize from saved or draft
  const [pages, setPages] = useState<Record<string, string>>(() => {
    const draft = loadDraft();
    if (draft && Object.keys(draft).length > 0) return draft;
    return pagesToDraft(settings.legalPages);
  });

  const [activeTab, setActiveTab] = useState<LegalPageKey>("privacyPolicy");
  // Bumped whenever `pages` is replaced wholesale (template applied, draft discarded)
  // so the uncontrolled RichTextEditor remounts and picks up the new content.
  const [pagesVersion, setPagesVersion] = useState(0);

  // Check for draft on mount
  const [hasDraft, setHasDraft] = useState(() => {
    const draft = loadDraft();
    if (!draft || Object.keys(draft).length === 0) return false;
    const saved = pagesToDraft(settings.legalPages);
    return Object.keys(saved).some((k) => draft[k] !== saved[k]);
  });

  // Auto-save draft every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      saveDraft(pages);
    }, 30000);
    return () => clearInterval(timer);
  }, [pages]);

  const updatePage = useCallback((key: string, value: string) => {
    setPages((prev) => ({ ...prev, [key]: value }));
    setHasDraft(true);
  }, [setHasDraft]);

  function applyTemplate() {
    if (!jurisdiction) {
      toast.error("Сначала выберите юрисдикцию.");
      return;
    }
    const template = getTemplate(jurisdiction as Jurisdiction);
    const filled: Record<string, string> = {};
    for (const [key, raw] of Object.entries(template)) {
      let text = raw
        .replaceAll("{{DATE}}", new Date().toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" }))
        .replaceAll("{{ENTITY_NAME}}", entityName || "[Company Name]")
        .replaceAll("{{ENTITY_ADDRESS}}", entityAddress || "[Company Address]")
        .replaceAll("{{ENTITY_EMAIL}}", entityEmail || "[privacy@company.com]")
        .replaceAll("{{ENTITY_WEBSITE}}", entityWebsite || "[https://company.com]")
        .replaceAll("{{RETENTION_APPLICANTS}}", String(retentionApplicants))
        .replaceAll("{{RETENTION_TALENT_POOL}}", String(retentionTalentPool));
      // Handle conditional DPO blocks
      text = text.replace(/\{\{#DPO\}\}([\s\S]*?)\{\{\/DPO\}\}/g, dpoEmail ? "$1" : "");
      filled[key] = renderMarkdown(text.trim());
    }
    setPages(filled);
    setHasDraft(true);
    setPagesVersion((v) => v + 1);
    saveDraft(filled);
    toast.success(`Шаблон ${JURISDICTION_LABELS[jurisdiction]} применен. Просмотрите и настройте.`);
  }

  function save() {
    startSave(async () => {
      const result = await saveLegalSettingsAction({
        legalEntityName: entityName || undefined,
        legalEntityAddress: entityAddress || undefined,
        legalEntityEmail: entityEmail || undefined,
        legalEntityWebsite: entityWebsite || undefined,
        legalJurisdiction: (jurisdiction as Jurisdiction) || undefined,
        dpoEmail: dpoEmail || undefined,
        dataRetentionApplicantsMonths: retentionApplicants,
        dataRetentionTalentPoolMonths: retentionTalentPool,
        dataRetentionEnabled: retentionEnabled,
        auditLogRetentionMonths: auditRetentionMonths,
        consentCheckboxText: consentText || undefined,
        legalPages: pages as LegalPages,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить.");
        return;
      }
      clearDraft();
      setHasDraft(false);
      toast.success("Юридические настройки сохранены.");
      router.refresh();
    });
  }

  function discardDraft() {
    setPages(pagesToDraft(settings.legalPages));
    setPagesVersion((v) => v + 1);
    clearDraft();
    setHasDraft(false);
    toast.success("Черновик отклонен");
  }

  const pageCount = Object.keys(pages).filter((k) => pages[k]?.trim()).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage text-pine ring-1 ring-pine/10">
            <SealCheckDuotoneIcon className="size-6" />
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-lg font-semibold tracking-tight">
                {"Юридические вопросы и соблюдение требований "}</h1>
              {settings.legalConfigured ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sage px-2.5 py-0.5 text-xs font-medium text-sage-ink">
                  <span className="size-1.5 rounded-full bg-pine" />
                  {"Настроен "}</span>
              ) : pageCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-clay/10 px-2.5 py-0.5 text-xs font-medium text-clay">
                  <span className="size-1.5 rounded-full bg-clay" />
                  {"Неполный "}</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                  {"Не настроено "}</span>
              )}
            </div>
            <p className="max-w-prose text-sm text-muted-foreground">
              {"Информация о юридических лицах, политика хранения данных и настраиваемые юридические страницы для вашей страницы вакансий и форм заявок. "}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasDraft ? (
            <Button variant="ghost" size="sm" onClick={discardDraft}>
              {"Отменить черновик "}</Button>
          ) : null}
          <Button onClick={save} disabled={saving}>
            {saving ? <SpinnerIcon className="size-4" /> : null}
            {"Сохранить изменения "}</Button>
        </div>
      </div>

      {/* Entity Information */}
      <Card className="gap-3 p-5">
        <h2 className="m-0 text-sm font-semibold text-foreground">{"Юридическое лицо"}</h2>
        <p className="-mt-2 text-xs text-muted-foreground">
          {"Основная информация об организации, ответственной за данные о кандидатах. "}</p>

        <div className="space-y-3">
          <Field>
            <Label htmlFor="legal-entity-name">{"Имя объекта"}</Label>
            <Input
              id="legal-entity-name"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder={"Акме Корп С.А."}
            />
          </Field>

          <Field>
            <Label htmlFor="legal-entity-address">{"Адрес"}</Label>
            <Input
              id="legal-entity-address"
              value={entityAddress}
              onChange={(e) => setEntityAddress(e.target.value)}
              placeholder={"Калле Майор 123, Мадрид, Испания"}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="legal-entity-email">{"Контактный адрес электронной почты"}</Label>
              <Input
                id="legal-entity-email"
                type="email"
                value={entityEmail}
                onChange={(e) => setEntityEmail(e.target.value)}
                placeholder="privacy@acme.com"
              />
            </Field>
            <Field>
              <Label htmlFor="legal-entity-website">{"Веб-сайт"}</Label>
              <Input
                id="legal-entity-website"
                type="url"
                value={entityWebsite}
                onChange={(e) => setEntityWebsite(e.target.value)}
                placeholder="https://acme.com"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="legal-jurisdiction">{"Юрисдикция"}</Label>
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger id="legal-jurisdiction">
                  <SelectValue placeholder={"Выберите юрисдикцию"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eu">{"Европейский Союз (ВВП)"}</SelectItem>
                  <SelectItem value="us">{"Соединенные Штаты"}</SelectItem>
                  <SelectItem value="cl">{"Чили (21,719 Лей)"}</SelectItem>
                  <SelectItem value="br">{"Бразилия (LGPD)"}</SelectItem>
                  <SelectItem value="other">{"Другое"}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="legal-dpo-email">{"Электронная почта DPO (необязательно)"}</Label>
              <Input
                id="legal-dpo-email"
                type="email"
                value={dpoEmail}
                onChange={(e) => setDpoEmail(e.target.value)}
                placeholder="dpo@acme.com"
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* Data Retention */}
      <Card className="gap-3 p-5">
        <h2 className="m-0 text-sm font-semibold text-foreground">{"Хранение данных"}</h2>
        <p className="-mt-2 text-xs text-muted-foreground">
          {"Как долго данные о кандидатах хранятся после завершения процесса найма. "}</p>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">{"Применять автоматически"}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {"Когда эта функция включена, ночная работа анонимизирует кандидатов после окончания периода хранения (имя, контактная информация и данные резюме редактируются, документы удаляются). Нанятые кандидаты и все, что находится под законным контролем, всегда игнорируется. История конвейера сохраняется для метрик. По умолчанию отключено. Указанные ниже месяцы являются рекомендательными, пока вы не включите эту функцию. "}</p>
          </div>
          <Switch
            checked={retentionEnabled}
            onCheckedChange={setRetentionEnabled}
            aria-label={"Обеспечьте автоматическое сохранение данных"}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <Label htmlFor="retention-applicants">{"Кандидаты (месяцы)"}</Label>
            <Input
              id="retention-applicants"
              type="number"
              min={1}
              max={120}
              value={retentionApplicants}
              onChange={(e) => setRetentionApplicants(Number(e.target.value) || 6)}
            />
            <p className="text-xs text-muted-foreground">
              {"По истечении этого периода неуспешные кандидаты анонимизируются."}{retentionEnabled ? "" : " как только вступит в силу правоприменение"}.
            </p>
          </Field>
          <Field>
            <Label htmlFor="retention-talent-pool">{"Кадровый резерв (месяцев)"}</Label>
            <Input
              id="retention-talent-pool"
              type="number"
              min={1}
              max={120}
              value={retentionTalentPool}
              onChange={(e) => setRetentionTalentPool(Number(e.target.value) || 24)}
            />
            <p className="text-xs text-muted-foreground">
              {"Кандидаты, которые присоединятся к вашему кадровому резерву. Требуется повторное согласие. "}</p>
          </Field>
        </div>
        <div className="max-w-sm">
          <Field>
            <Label htmlFor="retention-audit">{"Хранение журнала аудита (месяцы)"}</Label>
            <Input
              id="retention-audit"
              type="number"
              min={12}
              max={120}
              value={auditRetentionMonths}
              onChange={(e) => setAuditRetentionMonths(Number(e.target.value) || 24)}
            />
            <p className="text-xs text-muted-foreground">
              {"Аудиторские доказательства сокращаются с помощью защищенного ночного хранения. Минимум 12 месяцев. "}</p>
          </Field>
        </div>
      </Card>

      {/* Consent */}
      <Card className="gap-3 p-5">
        <h2 className="m-0 text-sm font-semibold text-foreground">{"Согласие"}</h2>
        <p className="-mt-2 text-xs text-muted-foreground">
          {"Текст, отображаемый рядом с флажком согласия в форме заявки. "}</p>

        <div>
          <Label htmlFor="consent-text">{"Текст флажка согласия"}</Label>
          <Textarea
            id="consent-text"
            value={consentText}
            onChange={(e) => setConsentText(e.target.value)}
            placeholder={"Я согласен на обработку моих персональных данных в целях трудоустройства. Я прочитал и принимаю Политику конфиденциальности."}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {"Ссылка на вашу Политику конфиденциальности будет добавлена автоматически, если она указана ниже. "}</p>
        </div>
      </Card>

      {/* Legal Pages Editor */}
      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{"Юридические страницы"}</h2>
            <p className="text-xs text-muted-foreground">
              {"Напишите свой юридический контент. Страницы опубликованы на"}{" "}
              <code className="text-xs">/legal/privacy-policy</code>,{" "}
              <code className="text-xs">/legal/terms-of-service</code>{"и т. д. "}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={jurisdiction} onValueChange={setJurisdiction}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={"Шаблон..."} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eu">{"Шаблон ЕС (GDPR)"}</SelectItem>
                <SelectItem value="us">{"Шаблон США"}</SelectItem>
                <SelectItem value="cl">{"Шаблон Чили (Ley 21.719)"}</SelectItem>
                <SelectItem value="br">{"Шаблон Бразилии (LGPD)"}</SelectItem>
                <SelectItem value="other">{"Общий шаблон"}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={applyTemplate} disabled={!jurisdiction}>
              {"Применить шаблон "}</Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LegalPageKey)}>
          <div className="border-b px-6 pt-3">
            <TabsList className="h-auto gap-0 bg-transparent p-0">
              {PAGE_KEYS.map((key) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className={cn(
                    "rounded-t-lg rounded-b-none border border-b-0 border-transparent px-3 py-2 text-xs font-medium text-muted-foreground transition-colors",
                    "data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground",
                  )}
                >
                  {LEGAL_PAGE_LABELS[key]}
                  {pages[key]?.trim() ? (
                    <span className="ml-1.5 size-1.5 rounded-full bg-pine" />
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {PAGE_KEYS.map((key) => (
            <TabsContent key={key} value={key} className="m-0 p-0">
              <div className="border-b px-6 py-2">
                <p className="text-xs text-muted-foreground">
                  /legal/{key.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "")}
                </p>
              </div>

              <div className="p-6">
                <RichTextEditor
                  key={pagesVersion}
                  defaultValue={pages[key] ?? ""}
                  placeholder={`Напишите здесь свой ${LEGAL_PAGE_LABELS[key].toLowerCase()}...`}
                  minHeight="24rem"
                  onChange={(html) => updatePage(key, html)}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}
