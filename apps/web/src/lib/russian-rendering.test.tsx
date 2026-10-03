import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { PipelineSpine } from "@/components/ui/PipelineSpine";
import { GreetingHeader, buildSubline } from "@/features/dashboard/GreetingHeader";
import { localizeSystemText, localizeStageName } from "./localize-system-text";
import { formatDistanceToNow } from "./date-format";

describe("Russian first render", () => {
  it("sends Russian labels in the initial server HTML before browser effects", () => {
    const html = renderToStaticMarkup(<>
      <JobStatusBadge status="draft" />
      <GreetingHeader name="Иван" avatarUrl={null} hour={10}
        subline={buildSubline({ waiting: 2, overdue: 1, interviewsToday: 3 })} />
    </>);
    expect(html).toContain("Черновик");
    expect(html).toContain("Доброе утро");
    expect(html).toContain("Кандидатов в работе: 2");
    expect(html).toContain("Собеседований сегодня: 3");
    expect(html).not.toMatch(/Draft|Good morning|candidates|interviews/);
  });

  it("localizes system errors and preserves names inserted into messages", () => {
    expect(localizeSystemText("Could not approve workflow.")).toBe("Не удалось утвердить рабочий процесс.");
    const text = localizeSystemText("AI evaluation generated for Dr. Smith.");
    expect(text).toContain("Dr. Smith");
    expect(text).toContain("Оценка ИИ");
    expect(localizeSystemText("Мой этап · Dr. Smith")).toBe("Мой этап · Dr. Smith");
  });

  it("formats relative dates in Russian regardless of the browser language", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(formatDistanceToNow(yesterday, { addSuffix: true })).toBe("1 день назад");
  });

  it("keeps stored stage values usable while displaying Russian copy", () => {
    const html = renderToStaticMarkup(<PipelineSpine current="Screening" showLabel />);
    expect(html).toContain("Первичный отбор (2 из 5)");
    expect(html).not.toContain("Stage:");
    expect(localizeStageName("My custom stage")).toBe("My custom stage");
  });
});
