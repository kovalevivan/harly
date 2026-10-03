"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { updateInterview } from "@/features/interviews/actions";
import { checkAvailability } from "@/lib/gcal/availability";
import { InterviewerSelect, type InterviewerOption } from "./InterviewerSelect";
import { DurationInput } from "./DurationInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CandidateInterviewItem } from "@/features/interviews/shared";
import {
  getBrowserTimeZone,
  parseScheduledAt,
} from "@/features/interviews/shared";

const TYPES = [
  { key: "screening", label: "Первичный отбор" },
  { key: "technical", label: "Технический" },
  { key: "culture_fit", label: "Культура соответствует" },
  { key: "onsite", label: "На месте" },
  { key: "final", label: "Финальный раунд" },
] as const;

const MODES = [
  { key: "video", label: "Видео", icon: () => <span className="inline-block size-4 rounded bg-current/20" /> },
  { key: "phone", label: "Телефон", icon: () => <span className="inline-block size-4 rounded bg-current/20" /> },
  { key: "onsite", label: "На месте", icon: () => <span className="inline-block size-4 rounded bg-current/20" /> },
] as const;

type TypeKey = (typeof TYPES)[number]["key"];
type ModeKey = (typeof MODES)[number]["key"];

export function EditInterviewDialog({
  interview,
  members,
  currentUserId,
  trigger,
}: {
  interview: CandidateInterviewItem;
  candidateId: string;
  members: InterviewerOption[];
  currentUserId?: string;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const prev = new Date(interview.scheduledAt);
  const prevDate = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
  const prevTime = `${String(prev.getHours()).padStart(2, "0")}:${String(prev.getMinutes()).padStart(2, "0")}`;

  const [type, setType] = useState<TypeKey>(interview.type);
  const [mode, setMode] = useState<ModeKey>(interview.mode);
  const [date, setDate] = useState(prevDate);
  const [time, setTime] = useState(prevTime);
  const [durationMins, setDurationMins] = useState(interview.durationMins);
  const [interviewerId, setInterviewerId] = useState(interview.interviewerId ?? "");
  const [location, setLocation] = useState(interview.location ?? "");
  const [notes, setNotes] = useState(interview.notes ?? "");
  const [title, setTitle] = useState(interview.title ?? "");
  const [isPending, startTransition] = useTransition();
  const [availabilityWarning, setAvailabilityWarning] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const locationLabel = mode === "onsite" ? "Адрес" : "Ссылка на встречу";

  async function checkTimeAvailability(
    newDate: string,
    newTime: string,
    duration: number,
    interviewer?: string,
  ) {
    if (!newDate || !newTime) {
      setAvailabilityWarning(null);
      return;
    }
    setCheckingAvailability(true);
    try {
      const timeZone = getBrowserTimeZone();
      const start = parseScheduledAt(`${newDate}T${newTime}`, timeZone);
      const end = new Date(start.getTime() + duration * 60_000);
      const result = await checkAvailability({
        timeMin: start,
        timeMax: end,
        interviewerId: interviewer ?? (interviewerId || undefined),
        excludeInterviewId: interview.id,
      });
      const warnings: string[] = [];
      if (result.gcalBusy.length > 0) {
        warnings.push(
          `${result.gcalBusy.length} существующее событие календаря`,
        );
      }
      if (result.internalConflicts.length > 0) {
        warnings.push(
          `${result.internalConflicts.length} перекрывающееся интервью в этом рабочем пространстве`,
        );
      }
      setAvailabilityWarning(
        warnings.length > 0
          ? `На этот раз конфликтует с ${warnings.join(" and ")}.`
          : null,
      );
    } catch {
      // Silently fail
    } finally {
      setCheckingAvailability(false);
    }
  }

  function submit() {
    if (!date || !time) {
      toast.error("Выберите дату и время.");
      return;
    }
    startTransition(async () => {
      const timeZone = getBrowserTimeZone();
      const result = await updateInterview({
        interviewId: interview.id,
        type,
        mode,
        scheduledAt: `${date}T${time}`,
        timeZone,
        durationMins,
        interviewerId: interviewerId || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        title: title.trim() || null,
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось обновить.");
        return;
      }
      if (result.warning) toast.warning(result.warning);
      toast.success("Интервью обновлено");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{"Редактировать интервью"}</DialogTitle>
          <DialogDescription>
            {"Обновите детали, смените интервьюера или перенесите встречу. "}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Field label={"Название (необязательно)"} htmlFor="edit-title">
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={"например Панель с командой инженеров"}
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Left column */}
            <div className="space-y-5">
              <Field label={"Тип"}>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map((t) => (
                    <SegButton
                      key={t.key}
                      active={type === t.key}
                      onClick={() => setType(t.key)}
                    >
                      {t.label}
                    </SegButton>
                  ))}
                </div>
              </Field>

              <Field label={"Режим"}>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map((m) => (
                    <SegButton
                      key={m.key}
                      active={mode === m.key}
                      onClick={() => setMode(m.key)}
                    >
                      {m.label}
                    </SegButton>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={"Дата"} htmlFor="edit-date">
                  <Input
                    id="edit-date"
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      checkTimeAvailability(e.target.value, time, durationMins);
                    }}
                  />
                </Field>
                <Field label={"Время"} htmlFor="edit-time">
                  <Input
                    id="edit-time"
                    type="time"
                    value={time}
                    onChange={(e) => {
                      setTime(e.target.value);
                      checkTimeAvailability(date, e.target.value, durationMins);
                    }}
                  />
                </Field>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-5">
              <DurationInput
                value={durationMins}
                onChange={(v) => {
                  setDurationMins(v);
                  checkTimeAvailability(date, time, v);
                }}
              />

              <InterviewerSelect
                value={interviewerId}
                onChange={(v) => {
                  setInterviewerId(v);
                  if (date && time) {
                    checkTimeAvailability(date, time, durationMins, v);
                  }
                }}
                members={members}
                currentUserId={currentUserId}
              />

              <Field label={locationLabel} htmlFor="edit-location">
                <Input
                  id="edit-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={
                    mode === "onsite"
                      ? "Адрес офиса…"
                      : "https://meet.google.com/…"
                  }
                />
              </Field>

              <Field label={"Примечания"} htmlFor="edit-notes">
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={"Области фокуса, панельная дискуссия, подготовка…"}
                  className="min-h-20"
                />
              </Field>
            </div>
          </div>

          {availabilityWarning ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{availabilityWarning}</span>
            </div>
          ) : null}
          {checkingAvailability ? (
            <p className="text-xs text-muted-foreground">{"Проверка доступности…"}</p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              {"Отмена "}</Button>
          </DialogClose>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? "Сохранение…" : "Сохранить изменения"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-medium tracking-tight text-foreground/90"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function SegButton({
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
        "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[13px] font-medium transition-colors",
        active
          ? "border-primary/40 bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
