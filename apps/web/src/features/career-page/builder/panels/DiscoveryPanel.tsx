"use client";

import { useSyncExternalStore } from "react";

import { FileDropzone } from "@/components/ui/FileDropzone";
import { Input } from "@/components/ui/input";
import type { CareerPageConfig } from "@/features/career-page/config";
import type { WorkspaceBoardBranding } from "@/features/workspaces/board";

import type { ConfigUpdater } from "../types";
import { Field, ToggleRow } from "../primitives";
import { PanelHeader, Section } from "./PanelKit";

export function DiscoveryPanel({
  config,
  update,
  workspace,
}: {
  config: CareerPageConfig;
  update: ConfigUpdater;
  workspace: WorkspaceBoardBranding;
}) {
  const title = config.seo.title || workspace.name || "Карьера";
  const description = config.seo.description || workspace.description || workspace.tagline || "Изучите открытые вакансии и постройте свою следующую главу вместе с нами.";
  const host = useSyncExternalStore(
    () => () => {},
    () => window.location.host,
    () => "",
  );
  const previewUrl = host ? `${host}/board/${workspace.slug}` : `/board/${workspace.slug}`;

  return (
    <div className="space-y-6">
      <PanelHeader title={"Открытие"} subtitle={"Управляйте тем, как ваш сайт вакансий будет отображаться в поиске и публикациях."} />

      <Section title={"Поисковые системы"} defaultOpen>
        <ToggleRow
          label={"Разрешить поисковым системам индексировать этот сайт вакансий"}
          checked={config.seo.indexable}
          onCheckedChange={(value) => update((draft) => (draft.seo.indexable = value))}
        />
        <p className="text-xs leading-5 text-ink-soft">
          {"Когда этот параметр отключен, страница вакансий и каждая вакансия используют noindex и удаляются из карты сайта Харли. "}</p>
        <Field label={"SEO-заголовок"}>
          <Input value={config.seo.title} maxLength={70} onChange={(event) => update((draft) => (draft.seo.title = event.target.value))} placeholder={workspace.name || "Карьера"} />
        </Field>
        <Field label={"Мета-описание"}>
          <textarea
            value={config.seo.description}
            maxLength={180}
            rows={4}
            onChange={(event) => update((draft) => (draft.seo.description = event.target.value))}
            placeholder={workspace.description ?? "Расскажите кандидатам, почему им стоит присоединиться."}
            className="flex w-full resize-y rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground outline-none placeholder:text-ink-soft focus-visible:ring-2 focus-visible:ring-pine/40"
          />
        </Field>
      </Section>

      <Section title={"Поделиться активами"}>
        <Field label={"Фавикон"}>
          <FileDropzone aspect="square" value={config.seo.faviconUrl} onChange={(url) => update((draft) => (draft.seo.faviconUrl = url))} />
        </Field>
        <Field label={"Изображение для публикации в социальных сетях"}>
          <FileDropzone aspect="banner" value={config.seo.socialImageUrl} onChange={(url) => update((draft) => (draft.seo.socialImageUrl = url))} />
        </Field>
      </Section>

      <Section title={"Предварительный просмотр поиска"}>
        <div className="space-y-1.5 rounded-lg border border-border bg-paper px-3 py-3">
          <p className="truncate text-xs text-success">{previewUrl}</p>
          <p className="line-clamp-2 text-sm font-medium text-pine">{title}</p>
          <p className="line-clamp-3 text-xs leading-5 text-ink-soft">{description}</p>
        </div>
      </Section>
    </div>
  );
}
