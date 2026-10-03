import type { Job } from "@harly/db";
import { Plus, Trash2, FileText } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import type { JobContentSection } from "../config";
import { generateJobDraftAction } from "../actions";
import { AiButton } from "@/components/ui/AiButton";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SECTION_TEMPLATES: Record<string, { title: string; body: string }[]> = {
  Engineering: [
    { title: "Что ты будешь делать", body: "<ul><li>Разрабатывать и выпускать новые функции</li><li>Участвовать в проектировании архитектуры</li></ul>" },
    { title: "Требования", body: "<ul><li>Опыт разработки веб-приложений от 3 лет</li><li>Уверенное знание TypeScript</li></ul>" },
    { title: "Преимущества", body: "<ul><li>Возможность удалённой работы</li><li>Участие в капитале компании</li></ul>" },
  ],
  Sales: [
    { title: "О роли", body: "<p>Вести клиентов по воронке продаж и заключать сделки.</p>" },
    { title: "Требования", body: "<ul><li>Опыт продаж корпоративным клиентам от 2 лет</li><li>Уверенная работа в CRM</li></ul>" },
    { title: "Компенсация", body: "<p>Оклад и процент от продаж без верхнего ограничения.</p>" },
  ],
  Generic: [
    { title: "Обязанности", body: "" },
    { title: "Требования", body: "" },
    { title: "Преимущества", body: "" },
  ],
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pickTemplateKey(title: string): keyof typeof SECTION_TEMPLATES {
  const t = title.toLowerCase();
  if (/(engineer|developer|programmer|software|backend|front[\s-]?end|full[\s-]?stack|data|devops|sre|qa)/.test(t))
    return "Инженерное дело";
  if (/(sales|account executive|business development|bdr|sdr|revenue)/.test(t))
    return "Продажи";
  return "Общий";
}

let sectionSeq = 0;
function newSectionId() {
  sectionSeq += 1;
  return `section-${sectionSeq}`;
}

export function DescriptionSection({
  job,
  description,
  setDescription,
  descriptionVersion,
  setDescriptionVersion,
  sections,
  setSections,
  title,
  keywords,
  aiPending,
  startAi,
}: {
  job?: Job;
  description: string;
  setDescription: (html: string) => void;
  descriptionVersion: number;
  setDescriptionVersion: React.Dispatch<React.SetStateAction<number>>;
  sections: JobContentSection[];
  setSections: React.Dispatch<React.SetStateAction<JobContentSection[]>>;
  title: string;
  keywords: string[];
  aiPending: boolean;
  startAi: React.TransitionStartFunction;
}) {
  function updateSection(id: string, patch: Partial<JobContentSection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, { id: newSectionId(), title: "", body: "" }]);
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function applyTemplate(name: keyof typeof SECTION_TEMPLATES) {
    setSections(SECTION_TEMPLATES[name].map((s) => ({ ...s, id: newSectionId() })));
  }

  function scaffoldDraft() {
    const base = SECTION_TEMPLATES[pickTemplateKey(title)].map((s) => ({
      ...s,
      id: newSectionId(),
    }));

    if (keywords.length > 0) {
      const list = `<ul>${keywords.map((kw) => `<li>${escapeHtml(kw)}</li>`).join("")}</ul>`;
      const ri = base.findIndex((s) => /требован/i.test(s.title));
      if (ri >= 0) base[ri] = { ...base[ri], body: list };
      else base.push({ id: newSectionId(), title: "Требования", body: list });
    }

    const roleName = title.trim() || "эта роль";
    setSections(base);
    setDescription(
      `<p>Приглашаем в команду на позицию <strong>${escapeHtml(roleName)}</strong>. Расскажите о задачах, команде и ожидаемых результатах.</p>`,
    );
    setDescriptionVersion((v) => v + 1);
  }

  function generateWithAI() {
    if (title.trim().length < 3) {
      toast.error("Сначала добавьте название должности.");
      return;
    }

    startAi(async () => {
      const result = await generateJobDraftAction({
        title,
        workplaceType: "remote",
        keywords,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const { draft } = result;
      setSections(
        draft.sections.map((section) => ({
          id: newSectionId(),
          title: section.title,
          body: `<ul>${section.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`,
        })),
      );
      setDescription(`<p>${escapeHtml(draft.summary)}</p>`);
      setDescriptionVersion((v) => v + 1);
      toast.success("Черновик создан с помощью ИИ");
    });
  }

  return (
    <section data-section="description">
      <div className="rounded-2xl border border-border/70 bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <p className="text-sm font-semibold">{"Описание"}</p>
          <div className="flex items-center gap-2">
            <AiButton
              type="button"
              size="sm"
              onClick={generateWithAI}
              loading={aiPending}
              loadingText={"Создание"}
              logoClassName="size-4"
            >
              {"Сгенерировать с помощью ИИ "}</AiButton>
            <Button type="button" variant="outline" size="sm" onClick={scaffoldDraft}>
              <FileText className="size-4" />
              {"Черновик для меня "}</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  {"Шаблоны "}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{"Заменить шаблоном"}</DropdownMenuLabel>
                {Object.keys(SECTION_TEMPLATES).map((name) => (
                  <DropdownMenuItem
                    key={name}
                    onClick={() => applyTemplate(name as keyof typeof SECTION_TEMPLATES)}
                  >
                    {({ Engineering: "Разработка", Sales: "Продажи", Generic: "Общий" } as Record<string, string>)[name] ?? name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="space-y-2">
            <Label>{"О роли"}</Label>
            <input type="hidden" name="description" value={description} />
            <RichTextEditor
              key={`description-${descriptionVersion}`}
              defaultValue={descriptionVersion === 0 ? job?.description : description}
              placeholder={"Опишите роль, команду и влияние."}
              minHeight="11rem"
              onChange={setDescription}
            />
          </div>

          {sections.map((section) => (
            <div key={section.id} className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Input
                  value={section.title}
                  onChange={(e) => updateSection(section.id, { title: e.target.value })}
                  placeholder={"Название раздела (например, Требования)"}
                  className="h-9 bg-card font-medium"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeSection(section.id)}
                  aria-label={"Удалить раздел"}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <RichTextEditor
                defaultValue={section.body}
                placeholder={"Напишите этот раздел..."}
                minHeight="7rem"
                onChange={(html) => updateSection(section.id, { body: html })}
              />
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addSection}>
            <Plus className="size-4" />
            {"Добавить раздел "}</Button>
        </div>
      </div>
    </section>
  );
}
