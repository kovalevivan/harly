"use client";

import { useState, type ReactNode } from "react";

import type {
  ApplicationFieldVisibility,
  JobApplicationConfig,
  JobApplicationFieldConfig,
} from "../config";
import { JobQuestionBuilder } from "../JobQuestionBuilder";
import { cn } from "@/lib/utils";

const visibilityOptions: Array<{
  value: ApplicationFieldVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "required",
    label: "Требуется",
    description: "Кандидаты должны заполнить это поле.",
  },
  {
    value: "optional",
    label: "Необязательно",
    description: "Покажите это, но позвольте кандидатам пропустить это.",
  },
  {
    value: "disabled",
    label: "Отключено",
    description: "Скройте его из формы заявки.",
  },
];

function VisibilityField({
  name,
  label,
  value,
  description,
}: {
  name: string;
  label: string;
  value: JobApplicationFieldConfig;
  description?: string;
}) {
  const [selected, setSelected] = useState<ApplicationFieldVisibility>(
    value.visibility,
  );

  return (
    <fieldset className="rounded-lg border border-input bg-card px-3.5 pt-2 pb-3">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        {label}
      </legend>
      {description ? (
        <p className="mb-3 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-3">
        {visibilityOptions.map((option) => {
          const checked = selected === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer flex-col rounded-md border px-3 py-2 transition-colors duration-150",
                checked
                  ? "border-pine/50 bg-sage/50"
                  : "border-border bg-background/60 hover:border-pine/30",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => setSelected(option.value)}
                className="sr-only"
              />
              <span className="text-sm font-medium">{option.label}</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function ApplicationSection({
  applicationConfig,
  aiContext,
}: {
  applicationConfig: JobApplicationConfig;
  aiContext?: {
    title: string;
    description: string;
    keywords: string[];
  };
}) {
  return (
    <div className="space-y-6">
      <FieldGroup
        title={"Личная информация"}
        description={"Имя и адрес электронной почты остаются обязательными. Настройте дополнительные поля, показанные в первом разделе формы заявки."}
      >
        <VisibilityField
          name="applicationPhoneVisibility"
          label={"Телефон"}
          value={applicationConfig.sections.personal.phone}
        />
        <VisibilityField
          name="applicationAddressVisibility"
          label={"Адрес"}
          value={applicationConfig.sections.personal.address}
        />
        <VisibilityField
          name="applicationPhotoVisibility"
          label={"Фото"}
          value={applicationConfig.sections.personal.photo}
          description={"Кандидаты могут загрузить фотографию профиля."}
        />
        <VisibilityField
          name="applicationHeadlineVisibility"
          label={"Заголовок"}
          value={applicationConfig.sections.personal.headline}
          description={"Краткое профессиональное название или резюме."}
        />
      </FieldGroup>

      <FieldGroup
        title={"Профиль"}
        description={"Контролируйте резюме и ссылки на профили."}
      >
        <VisibilityField
          name="applicationResumeVisibility"
          label={"Резюме"}
          value={applicationConfig.sections.profile.resume}
          description={"Кандидаты могут загружать PDF, DOC или DOCX."}
        />
        <VisibilityField
          name="applicationLinkedinVisibility"
          label="LinkedIn"
          value={applicationConfig.sections.profile.linkedinUrl}
        />
        <VisibilityField
          name="applicationGithubVisibility"
          label="GitHub"
          value={applicationConfig.sections.profile.githubUrl}
        />
        <VisibilityField
          name="applicationWebsiteVisibility"
          label={"Сайт/Портфолио"}
          value={applicationConfig.sections.profile.websiteUrl}
        />
        <VisibilityField
          name="applicationEducationVisibility"
          label={"Образование"}
          value={applicationConfig.sections.profile.education}
          description={"Кандидаты могут добавить одну или несколько записей об образовании."}
        />
        <VisibilityField
          name="applicationExperienceVisibility"
          label={"Опыт"}
          value={applicationConfig.sections.profile.experience}
          description={"Кандидаты могут добавить одну или несколько записей об опыте работы."}
        />
      </FieldGroup>

      <FieldGroup
        title={"Подробности"}
        description={"Добавьте проверочные вопросы, информацию для кандидатов и соглашения."}
      >
        <VisibilityField
          name="applicationCoverLetterVisibility"
          label={"Сопроводительное письмо"}
          value={applicationConfig.sections.details.coverLetter}
        />
        <div>
          <h3 className="mb-3 text-sm font-semibold">{"Пользовательское содержимое формы"}</h3>
          <JobQuestionBuilder
            initialQuestions={applicationConfig.questions}
            aiContext={aiContext}
          />
        </div>
      </FieldGroup>
    </div>
  );
}
