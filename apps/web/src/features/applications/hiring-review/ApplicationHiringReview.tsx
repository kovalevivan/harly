"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RussianFileInput } from "@/features/jobs/briefing/RussianFileInput";
import {
  statusLabels,
  verificationLabels,
} from "@/features/jobs/briefing/workflow";
import { summarizeHiringReview, type HiringReviewSummary } from "./summary";
import {
  getApplicationHiringReviewAction,
  queueApplicationResumeAction,
  uploadApplicationResumeAction,
} from "./actions";

type ReviewData = Extract<
  Awaited<ReturnType<typeof getApplicationHiringReviewAction>>,
  { ok: true }
>["data"];

export function ApplicationHiringReview({
  applicationId,
  reviewSummary,
  open,
  onOpenChange,
  onSummaryChange,
}: {
  applicationId: string;
  reviewSummary?: HiringReviewSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSummaryChange: (summary: HiringReviewSummary) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const loadedQueueId = useRef<string | null>(null);
  const [data, setData] = useState<ReviewData | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, start] = useTransition();
  const reviewing =
    data?.queue?.status === "queued" || data?.queue?.status === "running";
  const loaded = useCallback(
    (next: ReviewData) => {
      setData(next);
      if (next.queue && loadedQueueId.current !== next.queue.id) {
        loadedQueueId.current = next.queue.id;
        setResumeText(next.queue.resumeText);
      }
      onSummaryChange(summarizeHiringReview(applicationId, next));
    },
    [applicationId, onSummaryChange],
  );
  function run(operation: () => Promise<void>) {
    setNotice("");
    start(async () => {
      try {
        await operation();
      } catch {
        setNotice(
          "Не удалось выполнить действие. Ваш текст сохранён в поле. Повторите попытку.",
        );
      }
    });
  }
  function refresh() {
    run(async () => {
      const result = await getApplicationHiringReviewAction(applicationId);
      if (!result.ok) return setNotice(result.error);
      loaded(result.data);
    });
  }
  useEffect(() => {
    if (!open) return;
    container.current?.focus({ preventScroll: true });
    container.current?.scrollIntoView({ block: "start" });
  }, [open]);
  const refreshKey = `${reviewSummary?.status ?? ""}:${reviewSummary?.reviewId ?? ""}`;
  useEffect(() => {
    if (!open) return;
    let active = true;
    start(async () => {
      try {
        const result = await getApplicationHiringReviewAction(applicationId);
        if (!active) return;
        if (!result.ok) return setNotice(result.error);
        setNotice("");
        loaded(result.data);
      } catch {
        if (active) setNotice("Не удалось открыть разбор. Повторите загрузку.");
      }
    });
    return () => {
      active = false;
    };
  }, [open, applicationId, onSummaryChange, loaded, refreshKey]);
  useEffect(() => {
    if (!open || !reviewing) return;
    let active = true,
      polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const result = await getApplicationHiringReviewAction(applicationId);
        if (active && result.ok) {
          setData(result.data);
          onSummaryChange(summarizeHiringReview(applicationId, result.data));
        }
      } catch {
        /* Retry on the next poll; the durable task keeps running. */
      } finally {
        polling = false;
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [open, reviewing, applicationId, onSummaryChange]);
  async function queueReview(text: string) {
    const result = await queueApplicationResumeAction(applicationId, text);
    if (!result.ok) return setNotice(result.error);
    const refreshed = await getApplicationHiringReviewAction(applicationId);
    if (refreshed.ok) loaded(refreshed.data);
    setNotice(
      result.cached
        ? "Готовый разбор этого резюме уже сохранён."
        : result.status === "failed"
          ? "Автоматический разбор не выполнен. Причина указана выше."
          : "Разбор запущен. Можно закрыть страницу — результат сохранится в отклике.",
    );
  }
  const preferredReviewId = data
    ? summarizeHiringReview(applicationId, data).reviewId
    : null;
  const reviews = data
    ? [...data.reviews].sort((a, b) => {
        if (a.id === preferredReviewId) return -1;
        if (b.id === preferredReviewId) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      })
    : [];
  const fieldId = `resume-${applicationId}`;
  return (
    <div
      ref={container}
      id={`hiring-review-${applicationId}`}
      tabIndex={-1}
      className="mt-3 scroll-mt-24 rounded-xl border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Button
        variant="outline"
        disabled={busy}
        aria-expanded={open}
        aria-controls={`review-${applicationId}`}
        onClick={() => {
          setNotice("");
          onOpenChange(!open);
        }}
      >
        {open ? "Свернуть разбор резюме" : "Открыть разбор по профилю"}
      </Button>
      {open && (
        <section
          id={`review-${applicationId}`}
          aria-label="Разбор резюме отклика"
          className="mt-4 space-y-4"
        >
          <h4 className="font-semibold">Разбор резюме этого отклика</h4>
          <p className="text-sm text-muted-foreground">
            Оценка использует профиль сотрудника и сохранённый текст вакансии в
            Harly. Отсутствие сведений требует уточнения; решение о найме
            принимает человек.
          </p>
          {(busy || (!data && !notice)) && (
            <p role="status" aria-live="polite" className="text-sm">
              Выполняем запрос…
            </p>
          )}
          {!data && !busy && notice && (
            <Button variant="outline" onClick={refresh}>
              Повторить загрузку
            </Button>
          )}
          {data && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link
                  className="underline"
                  href={`/dashboard/jobs/${data.jobId}`}
                >
                  Открыть вакансию
                </Link>
                {data.briefId && data.canEditPlan && (
                  <Link
                    className="underline"
                    href={`/dashboard/jobs/briefs/${data.briefId}?step=2`}
                  >
                    Профиль сотрудника
                  </Link>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={refresh}
                >
                  Обновить данные
                </Button>
              </div>
              {!data.ready && (
                <p className="rounded-lg bg-muted p-3 text-sm">
                  Для этой вакансии ещё не утверждены профиль и описание. HR
                  должен завершить план подбора.
                </p>
              )}
              {data.profile && (
                <details>
                  <summary className="cursor-pointer text-sm">
                    Критерии профиля: {data.profile.criteria.length}
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {data.profile.criteria.map((c) => (
                      <li key={c.id}>
                        {c.label} · {c.required ? "Обязательно" : "Желательно"}{" "}
                        · {verificationLabels[c.verification]}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {!data.canWrite && (
                <p className="text-sm text-muted-foreground">
                  Доступны сохранённые разборы. Для нового разбора нужны права
                  на совместную работу с кандидатом.
                </p>
              )}
              {reviewing && (
                <p
                  role="status"
                  aria-live="polite"
                  className="rounded-lg bg-muted p-3 text-sm"
                >
                  {data.queue?.status === "queued"
                    ? "Разбор резюме в очереди"
                    : "Разбираем резюме…"}{" "}
                  Можно закрыть страницу — разбор продолжится.
                </p>
              )}
              {data.queue?.lastError && (
                <p role="alert" className="rounded-lg bg-muted p-3 text-sm">
                  {data.queue.lastError}
                </p>
              )}
              {data.canWrite && (
                <>
                  <label
                    htmlFor={`${fieldId}-file`}
                    className="block text-sm font-medium"
                  >
                    Загрузить резюме (PDF, DOCX или TXT)
                  </label>
                  <RussianFileInput
                    id={`${fieldId}-file`}
                    accept=".pdf,.docx,.txt"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const form = new FormData();
                      form.set("file", file);
                      run(async () => {
                        const result = await uploadApplicationResumeAction(
                          applicationId,
                          form,
                        );
                        if ("text" in result && typeof result.text === "string")
                          setResumeText(result.text);
                        if (!result.ok) return setNotice(result.error);
                        const refreshed =
                          await getApplicationHiringReviewAction(applicationId);
                        if (refreshed.ok) loaded(refreshed.data);
                        setNotice(
                          result.cached
                            ? "Готовый разбор этого резюме уже сохранён."
                            : "Резюме загружено. Разбор запущен автоматически.",
                        );
                      });
                      event.target.value = "";
                    }}
                  />
                  <label
                    htmlFor={fieldId}
                    className="block text-sm font-medium"
                  >
                    Текст резюме
                  </label>
                  <Textarea
                    id={fieldId}
                    rows={7}
                    maxLength={20000}
                    value={resumeText}
                    disabled={busy || reviewing}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Загрузка файла автоматически запускает разбор по
                    утверждённым требованиям. Можно вставить текст или оставить
                    поле пустым, чтобы использовать резюме, сохранённое в
                    карточке кандидата.
                  </p>
                  <Button
                    disabled={
                      busy ||
                      reviewing ||
                      !data.ready ||
                      Boolean(
                        resumeText.trim() && resumeText.trim().length < 50,
                      )
                    }
                    onClick={() => run(() => queueReview(resumeText))}
                  >
                    {busy || reviewing
                      ? "Разбираем резюме…"
                      : data.queue?.status === "failed" ||
                          data.queue?.status === "cancelled"
                        ? "Повторить разбор"
                        : "Сопоставить с профилем и вакансией"}
                  </Button>
                </>
              )}
              <h4 className="font-semibold">Сохранённые разборы</h4>
              {!data.reviews.length && (
                <p className="text-sm text-muted-foreground">
                  Этот отклик ещё не разбирали.
                </p>
              )}
              {reviews.map((review, index) => (
                <details
                  key={review.id}
                  open={index === 0}
                  className="rounded-xl border p-4"
                >
                  <summary className="cursor-pointer font-medium">
                    {review.candidateName} ·{" "}
                    {new Date(review.createdAt).toLocaleString("ru-RU")}
                  </summary>
                  <div className="mt-3 space-y-3">
                    {(!data.ready || review.reference !== data.reference) && (
                      <p className="rounded-lg bg-muted p-3 text-sm">
                        Разбор устарел: профиль или текст вакансии изменились.
                        Выполните новый разбор по текущим требованиям.
                      </p>
                    )}
                    <p>{review.summary}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">
                          Соответствие резюме профилю вакансии
                        </caption>
                        <thead>
                          <tr>
                            <th className="p-2">Критерий</th>
                            <th className="p-2">Подтверждения и проверка</th>
                          </tr>
                        </thead>
                        <tbody>
                          {review.assessments.map((a) => {
                            const c = review.criteria.find(
                              (c) => c.id === a.id,
                            );
                            return (
                              <tr key={a.id} className="border-t">
                                <td className="p-2 align-top">
                                  <strong>{c?.label}</strong>
                                  <p className="text-xs text-muted-foreground">
                                    {c && verificationLabels[c.verification]}
                                  </p>
                                </td>
                                <td className="space-y-1 p-2 align-top">
                                  <p className="font-medium">
                                    {statusLabels[a.status]}
                                  </p>
                                  {a.evidence && (
                                    <blockquote className="border-l-2 pl-3">
                                      «{a.evidence}»
                                    </blockquote>
                                  )}
                                  <p>{a.explanation}</p>
                                  <p className="text-muted-foreground">
                                    Уточнить: {a.question}
                                  </p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-sm">
                        Исходное резюме
                      </summary>
                      <p className="whitespace-pre-wrap text-sm">
                        {review.resumeText}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !data.canWrite}
                        onClick={() => {
                          setResumeText(review.resumeText);
                          setNotice(
                            "Исходный текст подставлен в поле резюме для нового разбора.",
                          );
                        }}
                      >
                        Использовать этот текст для нового разбора
                      </Button>
                    </details>
                  </div>
                </details>
              ))}
            </>
          )}
          {notice && (
            <p
              role="status"
              aria-live="polite"
              className="rounded-lg bg-muted p-3 text-sm"
            >
              {notice}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
