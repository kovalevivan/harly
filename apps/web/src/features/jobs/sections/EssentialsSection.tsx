import type { Job } from "@harly/db";

import { DepartmentCombobox } from "../DepartmentCombobox";
import { FieldBox, fieldBoxControlClassName, fieldBoxSelectTriggerClassName } from "@/components/ui/field-box";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const employmentTypes = [
  { value: "full_time", label: "Полная занятость" },
  { value: "part_time", label: "Частичная занятость" },
  { value: "contract", label: "Договор" },
  { value: "internship", label: "Стажировка" },
];

const workplaceTypes = [
  { value: "remote", label: "Удаленный" },
  { value: "hybrid", label: "Гибрид" },
  { value: "onsite", label: "На месте" },
];

export function EssentialsSection({
  job,
  departments,
  title,
  setTitle,
  titleError,
  setTitleError,
  workplace,
  setWorkplace,
}: {
  job?: Job;
  departments: string[];
  title: string;
  setTitle: (value: string) => void;
  titleError: boolean;
  setTitleError: (value: boolean) => void;
  workplace: string;
  setWorkplace: (value: string) => void;
}) {
  return (
    <section data-section="essentials" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldBox
          className="sm:col-span-2"
          label={"Название вакансии"}
          htmlFor="title"
          required
          error={titleError ? "Чтобы продолжить, добавьте название должности (минимум 3 символа)." : undefined}
        >
          <Input
            id="title"
            name="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(false);
            }}
            aria-invalid={titleError}
            placeholder={"Старший инженер полного стека"}
            className={fieldBoxControlClassName}
          />
        </FieldBox>

        <FieldBox label={"Отдел"}>
          <DepartmentCombobox
            name="department"
            departments={departments}
            defaultValue={job?.department}
            className={fieldBoxControlClassName}
          />
        </FieldBox>

        <FieldBox label={"Код страны для поиска"} htmlFor="jobLocationCountry">
          <Input
            id="jobLocationCountry"
            name="jobLocationCountry"
            defaultValue={job?.jobLocationCountry ?? ""}
            placeholder={"США"}
            maxLength={2}
            className={cnUppercase}
          />
        </FieldBox>

        <FieldBox label={"Штат или регион"} htmlFor="jobLocationRegion">
          <Input
            id="jobLocationRegion"
            name="jobLocationRegion"
            defaultValue={job?.jobLocationRegion ?? ""}
            placeholder={"Калифорния"}
            className={fieldBoxControlClassName}
          />
        </FieldBox>

        <FieldBox label={"Расположение"} htmlFor="location" hint={"Отображается в вашей публичной публикации."}>
          <Input
            id="location"
            name="location"
            defaultValue={job?.location ?? ""}
            placeholder={"Удаленный доступ, Латинская Америка"}
            className={fieldBoxControlClassName}
          />
        </FieldBox>

        <FieldBox label={"Тип занятости"} htmlFor="employmentType">
          <Select name="employmentType" defaultValue={job?.employmentType ?? "full_time"}>
            <SelectTrigger id="employmentType" className={fieldBoxSelectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {employmentTypes.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBox>

        <FieldBox label={"Тип рабочего места"} htmlFor="workplaceType">
          <Select name="workplaceType" value={workplace} onValueChange={setWorkplace}>
            <SelectTrigger id="workplaceType" className={fieldBoxSelectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workplaceTypes.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBox>
      </div>

      {workplace === "remote" ? (
        <FieldBox
          label={"Подходящие удаленные страны"}
          htmlFor="remoteEligibleCountries"
          hint={"Оставьте пустым для всего мира."}
        >
          <Input
            id="remoteEligibleCountries"
            name="remoteEligibleCountries"
            defaultValue={(job?.remoteEligibleCountries as string[] | undefined)?.join(", ") ?? ""}
            placeholder="US, CA, CL"
            className={fieldBoxControlClassName}
          />
        </FieldBox>
      ) : null}

      <FieldBox label={"Срок публикации истекает"} htmlFor="validThrough">
        <Input
          id="validThrough"
          name="validThrough"
          type="date"
          defaultValue={job?.validThrough ? job.validThrough.toISOString().slice(0, 10) : ""}
          className={fieldBoxControlClassName}
        />
      </FieldBox>
    </section>
  );
}

const cnUppercase = `${fieldBoxControlClassName} заглавная буква`;
