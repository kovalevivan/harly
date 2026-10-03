"use client";

import { localizeStageName } from "@/lib/localize-system-text";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Link2, MapPin, Phone, Video } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { scheduleInterview } from "@/features/interviews/actions";
import { checkAvailability } from "@/lib/gcal/availability";
import { buildCalBookingLink } from "@/lib/cal/link";
import { InterviewerSelect } from "./InterviewerSelect";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getBrowserTimeZone,
  parseScheduledAt,
} from "@/features/interviews/shared";

export type ScheduleApplicationOption = {
  applicationId: string;
  jobTitle: string;
  currentStageName: string | null;
};

export type ScheduleMemberOption = {
  userId: string;
  name: string;
  image: string | null;
};

const TYPES = [
  { key: "screening", label: "Первичный отбор" },
  { key: "technical", label: "Технический" },
  { key: "culture_fit", label: "Культура соответствует" },
  { key: "onsite", label: "На месте" },
  { key: "final", label: "Финальный раунд" },
] as const;

const MODES = [
  { key: "video", label: "Видео", icon: Video },
  { key: "phone", label: "Телефон", icon: Phone },
  { key: "onsite", label: "На месте", icon: MapPin },
] as const;

type TypeKey = (typeof TYPES)[number]["key"];
type ModeKey = (typeof MODES)[number]["key"];

export type ScheduleCalConfig = {
  enabled: boolean;
  bookingUrl: string | null;
};

export function ScheduleDialog({
  candidateId,
  workspaceId,
  candidateName,
  candidateEmail,
  applications,
  members,
  cal,
  currentUserId,
  trigger,
}: {
  candidateId: string;
  workspaceId: string;
  candidateName: string;
  candidateEmail: string;
  applications: ScheduleApplicationOption[];
  members: ScheduleMemberOption[];
  cal: ScheduleCalConfig;
  currentUserId?: string;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [applicationId, setApplicationId] = useState(
    applications[0]?.applicationId ?? "",
  );
  const [type, setType] = useState<TypeKey>("screening");
  const [mode, setMode] = useState<ModeKey>("video");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationMins, setDurationMins] = useState(45);
  const [interviewerId, setInterviewerId] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(Boolean(candidateEmail.trim()));
  const [isPending, startTransition] = useTransition();
  const [availabilityWarning, setAvailabilityWarning] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const hasApplication = applications.length > 0;
  const hasCandidateEmail = candidateEmail.trim().length > 0;
  const locationLabel = mode === "onsite" ? "Адрес" : "Ссылка на встречу";

  const calLinkAvailable = cal.enabled && Boolean(cal.bookingUrl);

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
      });
      const warnings: string[] = [];
      if (result.gcalBusy.length > 0) {
        warnings.push(
          `${result.gcalBusy.length} существующее событие календаря${result.gcalBusy.length > 1 ? "s" : ""}`,
        );
      }
      if (result.internalConflicts.length > 0) {
        warnings.push(
          `${result.internalConflicts.length} перекрывающееся интервью${result.internalConflicts.length > 1 ? "s" : ""} в этом рабочем пространстве`,
        );
      }
      setAvailabilityWarning(
        warnings.length > 0
          ? `На этот раз конфликтует с ${warnings.join(" and ")}.`
          : null,
      );
    } catch {
      // Silently fail , don't block scheduling on availability check.
    } finally {
      setCheckingAvailability(false);
    }
  }

  function copyBookingLink() {
    if (!cal.bookingUrl) return;
    if (!applicationId) {
      toast.error("Выберите, для какой роли предназначено это интервью.");
      return;
    }
    const link = buildCalBookingLink({
      bookingUrl: cal.bookingUrl,
      name: candidateName,
      email: candidateEmail,
      metadata: { applicationId, candidateId, workspaceId },
    });
    void navigator.clipboard.writeText(link);
    toast.success("Ссылка на бронирование скопирована. Отправьте это кандидату");
  }

  function reset() {
    setType("screening");
    setMode("video");
    setDate("");
    setTime("");
    setDurationMins(45);
    setInterviewerId("");
    setLocation("");
    setNotes("");
    setSendEmail(hasCandidateEmail);
    setAvailabilityWarning(null);
  }

  function submit() {
    if (!hasApplication) {
      toast.error("У этого кандидата нет заявки, к которой можно прикрепить собеседование.");
      return;
    }
    if (!applicationId) {
      toast.error("Выберите, для какой роли предназначено это интервью.");
      return;
    }
    if (!date || !time) {
      toast.error("Выберите дату и время.");
      return;
    }
    startTransition(async () => {
      const timeZone = getBrowserTimeZone();
      const result = await scheduleInterview({
        workspaceId,
        candidateId,
        applicationId,
        type,
        mode,
        scheduledAt: `${date}T${time}`,
        timeZone,
        durationMins,
        interviewerId: interviewerId || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        sendEmail: sendEmail && hasCandidateEmail,
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось запланировать.");
        return;
      }
      if (result.warning && result.emailStatus !== "failed") {
        toast.warning(result.warning);
      }
      if (result.emailStatus === "sent") {
        toast.success("Собеседование назначено, приглашение отправлено.");
      } else if (result.emailStatus === "skipped") {
        toast.success("Собеседование назначено без отправки приглашения");
      } else if (result.emailStatus === "failed") {
        toast.warning(
          result.warning ??
            "Собеседование запланировано, но письмо с приглашением не удалось отправить.",
        );
      } else {
        toast.success("Интервью запланировано");
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{"Назначить собеседование"}</DialogTitle>
          <DialogDescription>
            {"Добавлено в график кандидатов и в повестку дня команды. "}</DialogDescription>
        </DialogHeader>

        {!hasApplication ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {"Этот кандидат еще не подавал заявки ни на одну должность. Собеседование прилагается к заявке. "}</p>
        ) : (
          <div className="space-y-5">
            {calLinkAvailable ? (
              <div className="space-y-2.5 rounded-xl border border-primary/30 bg-accent/40 p-3.5">
                <div className="flex items-center gap-2">
                  <Link2 className="size-4 text-primary" strokeWidth={1.8} />
                  <p className="text-[13px] font-medium tracking-tight">
                    {"Позвольте кандидату самостоятельно составить график "}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {"Отправьте ссылку Cal.com. Когда они записываются, интервью автоматически синхронизируется здесь. "}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full bg-card"
                  onClick={copyBookingLink}
                >
                  <Link2 className="size-4" />
                  {"Скопировать ссылку на бронирование "}</Button>
                <p className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">
                  {"или войдите вручную "}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Left column */}
              <div className="space-y-5">
                {applications.length > 1 ? (
                  <Field label={"Роль"}>
                    <Select value={applicationId} onValueChange={setApplicationId}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {applications.map((application) => (
                          <SelectItem
                            key={application.applicationId}
                            value={application.applicationId}
                          >
                            {application.jobTitle}
                            {application.currentStageName
                              ? ` · ${localizeStageName(application.currentStageName ?? "")}`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    {"Для"}{" "}
                    <span className="font-medium text-foreground">
                      {applications[0]?.jobTitle}
                    </span>
                  </p>
                )}

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
                        <m.icon className="size-4" strokeWidth={1.8} />
                        {m.label}
                      </SegButton>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={"Дата"} htmlFor="schedule-date">
                    <Input
                      id="schedule-date"
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        checkTimeAvailability(e.target.value, time, durationMins);
                      }}
                    />
                  </Field>
                  <Field label={"Время"} htmlFor="schedule-time">
                    <Input
                      id="schedule-time"
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

                <Field label={locationLabel} htmlFor="schedule-location">
                  <Input
                    id="schedule-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={
                      mode === "onsite"
                        ? "Адрес офиса…"
                        : "https://meet.google.com/…"
                    }
                  />
                </Field>

                <Field label={"Примечания"} htmlFor="schedule-notes">
                  <Textarea
                    id="schedule-notes"
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

            <label className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3.5 py-3">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
                disabled={!hasCandidateEmail}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">
                  {"Отправить приглашение по электронной почте "}</span>
                <span className="block text-xs text-muted-foreground">
                  {hasCandidateEmail
                    ? "Подробности собеседования кандидат получит после записи."
                    : "Прежде чем отправлять приглашение, добавьте адрес электронной почты этому кандидату."}
                </span>
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              {"Отмена "}</Button>
          </DialogClose>
          <Button onClick={submit} disabled={isPending || !hasApplication}>
            {isPending
              ? sendEmail && hasCandidateEmail
                ? "Планирование и отправка…"
                : "Планирование…"
              : sendEmail && hasCandidateEmail
                ? "Запланировать и отправить приглашение"
                : "Расписание без электронной почты"}
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
