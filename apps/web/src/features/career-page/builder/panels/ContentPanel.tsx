"use client";

import { FileDropzone } from "@/components/ui/FileDropzone";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

import type { CareerPageConfig } from "@/features/career-page/config";
import type { WorkspaceBoardBranding } from "@/features/workspaces/board";
import type { ConfigUpdater } from "../types";
import { Field, ToggleRow, ColorField, IconSelect, ListEditor, move } from "../primitives";
import { AlignLeftIcon, AlignCenterIcon, AlignRightIcon } from "../builder-icons";
import { PanelHeader, Section, Segmented } from "./PanelKit";

type ContentPanelProps = {
  config: CareerPageConfig;
  update: ConfigUpdater;
  workspace: WorkspaceBoardBranding & { id: string };
};

export function ContentPanel({ config, update, workspace }: ContentPanelProps) {
  return (
    <div className="space-y-6">
      <PanelHeader title={"Содержание"} subtitle={"Заголовки, изображения и вступительный контент."} />

      <Section title={"Герой"} defaultOpen>
        <Field label={"Заголовок"}>
          <Input
            value={config.hero.headline}
            onChange={(e) => update((d) => (d.hero.headline = e.target.value))}
            placeholder={"Присоединяйтесь к нам"}
          />
        </Field>
        <Field label={"Подзаголовок"}>
          <Input
            value={config.hero.subhead}
            onChange={(e) => update((d) => (d.hero.subhead = e.target.value))}
            placeholder={"Короткий слоган или формулировка миссии"}
          />
        </Field>
        <ToggleRow
          label={"Показать заголовок"}
          checked={config.hero.showHeadline}
          onCheckedChange={(v) => update((d) => (d.hero.showHeadline = v))}
        />

        {/* Minimal-specific hero options */}
        {config.template === "minimal" && (
          <>
            <ToggleRow
              label={"Используйте изображение баннера вместо верхней панели"}
              checked={config.hero.bannerEnabled}
              onCheckedChange={(v) => update((d) => (d.hero.bannerEnabled = v))}
            />
            {config.hero.bannerEnabled && (
              <>
                <Field label={"Изображение баннера"}>
                  <FileDropzone
                    aspect="banner"
                    value={config.hero.imageUrl}
                    onChange={(url) => update((d) => (d.hero.imageUrl = url))}
                  />
                </Field>
                <Field label={`Непрозрачность наложения, ${config.hero.overlayOpacity}%`}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={config.hero.overlayOpacity}
                    onChange={(e) =>
                      update((d) => (d.hero.overlayOpacity = Number(e.target.value)))
                    }
                    className="w-full accent-pine"
                  />
                </Field>
                <Field label={"Вариант логотипа баннера"}>
                  <Segmented
                    value={config.hero.bannerLogoVariant}
                    onChange={(v) => update((d) => (d.hero.bannerLogoVariant = v))}
                    options={[
                      { value: "dark", label: "Белые буквы" },
                      { value: "light", label: "Темные буквы" },
                    ]}
                  />
                </Field>
                <Field label={"Полный логотип, белые буквы для темных баннеров."}>
                  <FileDropzone
                    aspect="banner"
                    value={config.hero.bannerLogoDark}
                    onChange={(url) => update((d) => (d.hero.bannerLogoDark = url))}
                  />
                </Field>
                <Field label={"Полный логотип, темные буквы для светлых баннеров."}>
                  <FileDropzone
                    aspect="banner"
                    value={config.hero.bannerLogoLight}
                    onChange={(url) => update((d) => (d.hero.bannerLogoLight = url))}
                  />
                </Field>
              </>
            )}
          </>
        )}

        {/* Logo type + CTA text , Minimal and Join (topbar-based heroes) */}
        {(config.template === "minimal" || config.template === "join") && (
          <>
            <Field label={"Логотип для отображения"}>
              <Segmented
                value={config.hero.logoType}
                onChange={(v) => update((d) => (d.hero.logoType = v))}
                options={[
                  { value: "logo", label: "Квадратный знак" },
                  { value: "fullLogo", label: "Полный текстовый знак" },
                ]}
              />
            </Field>
            <Field label={"Текст кнопки"}>
              <Input
                value={config.hero.ctaButtonText}
                onChange={(e) => update((d) => (d.hero.ctaButtonText = e.target.value))}
                placeholder={"Посмотреть вакансии"}
              />
            </Field>
          </>
        )}

        {/* Banner image + overlay , Playful & Ashby */}
        {(config.template === "playful" || config.template === "ashby") && (
          <>
            <Field label={"Изображение баннера"}>
              <FileDropzone
                aspect="banner"
                value={config.hero.imageUrl}
                onChange={(url) => update((d) => (d.hero.imageUrl = url))}
              />
            </Field>
            <ToggleRow
              label={"Наложение градиента"}
              checked={config.hero.overlay === "gradient"}
              onCheckedChange={(v) =>
                update((d) => (d.hero.overlay = v ? "gradient" : "none"))
              }
            />
            {config.hero.overlay === "gradient" && (
              <div className="grid grid-cols-2 gap-2">
                <ColorField
                  label={"От"}
                  value={config.hero.overlayFrom}
                  fallback={config.theme.accent ?? workspace.primaryColor}
                  onChange={(c) => update((d) => (d.hero.overlayFrom = c))}
                />
                <ColorField
                  label={"Кому"}
                  value={config.hero.overlayTo}
                  fallback="#ffffff"
                  onChange={(c) => update((d) => (d.hero.overlayTo = c))}
                />
              </div>
            )}
          </>
        )}

        <Field label={"Расположение логотипа"}>
          <Segmented
            value={config.hero.logoPosition}
            onChange={(v) => update((d) => (d.hero.logoPosition = v))}
            options={[
              { value: "left", label: "Левый", icon: <AlignLeftIcon className="size-3.5" strokeWidth={1.8} /> },
              { value: "center", label: "Центр", icon: <AlignCenterIcon className="size-3.5" strokeWidth={1.8} /> },
              { value: "right", label: "Правильно", icon: <AlignRightIcon className="size-3.5" strokeWidth={1.8} /> },
            ]}
          />
        </Field>
        <ToggleRow
          label={"Показывать название компании рядом с логотипом"}
          checked={config.hero.showName}
          onCheckedChange={(v) => update((d) => { d.hero.showName = v; })}
        />
      </Section>

      <Section title={"Введение и содержание"}>
        <Field label={"Введение / о нас"}>
          <RichTextEditor
            key={config.template}
            defaultValue={config.intro.body}
            placeholder={"Расскажите кандидатам о вашей компании, культуре, миссии…"}
            minHeight="10rem"
            onChange={(html) => update((d) => (d.intro.body = html))}
          />
        </Field>
        {config.template === "playful" && (
          <ListEditor
            label={"Чипсы"}
            items={config.intro.chips}
            onAdd={() =>
              update((d) => d.intro.chips.push({ label: "Новый", icon: "" }))
            }
            onRemove={(i) => update((d) => d.intro.chips.splice(i, 1))}
            onMove={(i, dir) => update((d) => move(d.intro.chips, i, dir))}
            render={(chip, i) => (
              <div className="flex gap-2">
                <Input
                  value={chip.label}
                  onChange={(e) =>
                    update((d) => (d.intro.chips[i].label = e.target.value))
                  }
                  placeholder={"Этикетка"}
                  className="min-w-0"
                />
                <IconSelect
                  value={chip.icon ?? ""}
                  onChange={(v) => update((d) => (d.intro.chips[i].icon = v))}
                />
              </div>
            )}
          />
        )}
      </Section>
    </div>
  );
}
