"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RussianFileInput } from "@/features/jobs/briefing/RussianFileInput";
import {
  statusLabels,
  verificationLabels,
} from "@/features/jobs/briefing/workflow";
import {
  getApplicationHiringReviewAction,
  reviewApplicationResumeAction,
  extractApplicationResumeAction,
} from "./actions";

type ReviewData = Extract<
  Awaited<ReturnType<typeof getApplicationHiringReviewAction>>,
  { ok: true }
>["data"];

export function ApplicationHiringReview({
  applicationId,
}: {
  applicationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReviewData | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, start] = useTransition();
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
      setData(result.data);
    });
  }
  const fieldId = `resume-${applicationId}`;
  return (
    <div className="mt-3 rounded-xl border bg-card p-4">
      <Button
        variant="outline"
        disabled={busy}
        aria-expanded={open}
        aria-controls={`review-${applicationId}`}
        onClick={() => {
          setOpen(!open);
          if (!open) refresh();
        }}
      >
        Оценить по профилю вакансии
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
          {busy && (
            <p role="status" aria-live="polite" className="text-sm">
              Выполняем запрос…
            </p>
          )}
          {!data && !busy && (
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
              {data.ready && data.canWrite && (
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
                        const result = await extractApplicationResumeAction(
                          applicationId,
                          form,
                        );
                        if (!result.ok) return setNotice(result.error);
                        setResumeText(result.text);
                        setNotice(
                          "Текст извлечён. Проверьте его перед разбором.",
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
                    disabled={busy}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Можно вставить текст или оставить поле пустым, чтобы
                    использовать резюме, сохранённое в карточке кандидата.
                  </p>
                  <Button
                    disabled={
                      busy ||
                      Boolean(
                        resumeText.trim() && resumeText.trim().length < 50,
                      )
                    }
                    onClick={() =>
                      run(async () => {
                        const result = await reviewApplicationResumeAction({
                          applicationId,
                          resumeText,
                          expectedVersion: data.version,
                          expectedReference: data.reference,
                        });
                        if (!result.ok) return setNotice(result.error);
                        setData({
                          ...data,
                          version: result.version,
                          reviews: [...data.reviews, result.review],
                        });
                        setNotice("Разбор сохранён в этом отклике.");
                      })
                    }
                  >
                    {busy
                      ? "Разбираем резюме…"
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
              {[...data.reviews].reverse().map((review, index) => (
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
