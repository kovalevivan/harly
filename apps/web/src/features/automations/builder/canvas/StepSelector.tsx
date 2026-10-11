"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckSquare,
  Clock,
  GitBranch,
  Mail,
  OctagonX,
  Search,
  ShieldCheck,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ActionType } from "../../schema";
import type { BlockKind } from "../state/blocks";

export type StepInsertOption = {
  id: string;
  kind: BlockKind;
  actionType?: ActionType;
  label: string;
  blurb: string;
  Icon: React.ComponentType<{ className?: string }>;
};

export const QUICK_STEP_OPTIONS: StepInsertOption[] = [
  {
    id: "send_email",
    kind: "action",
    actionType: "send_email",
    label: "Отправить письмо",
    blurb: "Отправьте электронное письмо кандидату или команде",
    Icon: Mail,
  },
  {
    id: "delay",
    kind: "delay",
    label: "Подожди",
    blurb: "Пауза на определенное время или по местному времени",
    Icon: Clock,
  },
  {
    id: "condition",
    kind: "condition",
    label: "Состояние",
    blurb: "Филиал в зависимости от кандидата или правил работы",
    Icon: GitBranch,
  },
  {
    id: "move_stage",
    kind: "action",
    actionType: "move_stage",
    label: "Переместить этап",
    blurb: "Перевести кандидата на другой этап конвейера",
    Icon: ArrowRight,
  },
  {
    id: "add_note",
    kind: "action",
    actionType: "add_note",
    label: "Добавить примечание",
    blurb: "Добавьте внутреннюю заметку в профиль кандидата",
    Icon: CheckSquare,
  },
  {
    id: "approval",
    kind: "approval",
    label: "Одобрение",
    blurb: "Требовать подписания члена команды, чтобы продолжить",
    Icon: ShieldCheck,
  },
  {
    id: "end",
    kind: "end",
    label: "Завершить автоматизацию",
    blurb: "Завершите или остановите этот путь выполнения",
    Icon: OctagonX,
  },
];

export function StepSelector({
  onSelect,
  trigger,
  title = "Вставить шаг",
  align = "center",
}: {
  onSelect: (kind: BlockKind, actionType?: ActionType) => void;
  trigger: React.ReactNode;
  title?: string;
  align?: "center" | "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = QUICK_STEP_OPTIONS.filter(
    (opt) =>
      !search.trim() ||
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      opt.blurb.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        side="bottom"
        sideOffset={8}
        className="w-72 rounded-xl border border-border bg-pure-snow p-2 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 border-b border-hairline px-2 py-1.5">
          <p className="font-display text-xs font-semibold text-foreground">
            {title}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-border bg-warm-paper px-2 py-1">
            <Search className="size-3 shrink-0 text-soft-ink" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={"Шаги поиска…"}
              className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-soft-ink"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-60 space-y-0.5 overflow-y-auto">
          {filtered.map((item) => {
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.kind, item.actionType);
                  setOpen(false);
                  setSearch("");
                }}
                className="group flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-soft-kraft/60"
              >
                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-soft-kraft text-soft-ink transition-colors group-hover:bg-foreground group-hover:text-background">
                  <Icon className="size-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="line-clamp-1 text-[11px] text-soft-ink">
                    {item.blurb}
                  </p>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-4 text-center text-xs text-soft-ink">
              {"Нет шагов, соответствующих вашему запросу. "}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
