import { UserAvatar } from "@/components/ui/UserAvatar";

/**
 * Home's identity moment (DESIGN.md , Morning Greeting Header).
 *
 * Avatar + "Good morning, {First}!" at greeting scale, and one short
 * operational subline. Deliberately not the old header: no waving emoji, no
 * "Let's go!", no date stamp in the corner competing for the eye. In a
 * GDPR-ready hiring tool that tone reads as a toy , and the frame's greeting is
 * a single calm line.
 */
export function GreetingHeader({
  name,
  avatarUrl,
  hour,
  subline,
}: {
  name: string;
  avatarUrl: string | null;
  hour: number;
  subline: string;
}) {
  return (
    <header className="flex items-center gap-3 pt-4">
      <UserAvatar name={name} src={avatarUrl} size="md" priority />
      <div className="min-w-0">
        <h1 className="font-display truncate text-[24px] leading-tight text-near-ink">
          {greeting(hour)}, {name}!
        </h1>
        <p className="mt-0.5 text-[13px] text-soft-ink">{subline}</p>
      </div>
    </header>
  );
}

function greeting(hour: number) {
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

/**
 * Operational, countable, and never cheerful about an empty pipeline. Reads the
 * two numbers a recruiter is actually deciding on at 9:12am.
 */
export function buildSubline({
  waiting,
  overdue,
  interviewsToday,
}: {
  waiting: number;
  overdue: number;
  interviewsToday: number;
}) {
  const parts: string[] = [];

  if (waiting > 0) {
    parts.push(
      `Кандидатов в работе: ${waiting}`,
    );
  }
  if (overdue > 0) {
    parts.push(`Ожидают больше недели: ${overdue}`);
  }
  if (interviewsToday > 0) {
    parts.push(
      `Собеседований сегодня: ${interviewsToday}`,
    );
  }

  if (parts.length === 0) return "Сейчас нет задач, требующих решения.";
  return `${parts.join(" · ")}.`;
}
