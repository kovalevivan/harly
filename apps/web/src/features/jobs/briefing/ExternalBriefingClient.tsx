"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { briefTopics, type BriefAnswer } from "./model";
import type { HiringIntake } from "./workflow";

type PublicBrief = {
  title: string;
  answers: BriefAnswer[];
  intake: Omit<HiringIntake, "agentHistory">;
  updatedAt: string;
  busy: boolean;
  lastTurn?: { id: string; message: string; status: string };
};
export function ExternalBriefingClient({ inviteId }: { inviteId: string }) {
  const [brief, setBrief] = useState<PublicBrief | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [summary, setSummary] = useState(false);
  const [edits, setEdits] = useState<BriefAnswer[]>([]);
  const endpoint = `/api/public/briefing/${inviteId}`;
  async function request(body?: object) {
    const response = await fetch(
      endpoint,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : { cache: "no-store" },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Не удалось выполнить запрос.");
    return data;
  }
  async function reload() {
    const data = await request();
    setBrief(data);
    return data as PublicBrief;
  }
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = new URLSearchParams(window.location.hash.slice(1)).get(
          "token",
        );
        if (token) {
          await request({ action: "exchange", token });
          window.history.replaceState(null, "", window.location.pathname);
        }
        const data = await request();
        if (alive) setBrief(data);
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Не удалось открыть брифинг.",
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // Invitation is stable for this page. Strict Mode exchanges are idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteId]);
  async function send(text: string, retryId?: string) {
    if (!brief) return;
    const id = retryId || crypto.randomUUID();
    setBusy(true);
    setRequestId(id);
    setError("");
    try {
      setBrief(
        await request({
          action: "message",
          message: text,
          requestId: id,
          expectedVersion: brief.updatedAt,
        }),
      );
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось получить ответ.");
      try {
        await reload();
      } catch {
        /* Preserve the draft while offline. */
      }
    } finally {
      setBusy(false);
      setRequestId(null);
    }
  }
  async function cancel() {
    if (!requestId) return;
    try {
      setBrief(await request({ action: "cancel", requestId }));
      setError("Запрос отменён. Сообщение сохранено, требования не изменены.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отменить запрос.");
    }
  }
  async function finish() {
    if (!brief) return;
    setBusy(true);
    setError("");
    try {
      setBrief(
        await request({ action: "complete", expectedVersion: brief.updatedAt }),
      );
      setSummary(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось передать бриф HR.");
    } finally {
      setBusy(false);
    }
  }
  const closed = brief?.intake.completed;
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm text-muted-foreground">
          Harly · Брифинг руководителя
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          {brief?.title || "Требования к сотруднику"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Расскажите, кого ищете. ИИ уточнит требования, а итог вы проверите
          перед передачей HR.
        </p>
      </header>
      {loading && <p role="status">Открываем брифинг…</p>}
      {error && (
        <p role="alert" className="rounded-xl border bg-muted p-4">
          {error}
        </p>
      )}
      {!loading && !brief && (
        <Button variant="outline" onClick={() => window.location.reload()}>
          Повторить открытие
        </Button>
      )}
      {brief && (
        <>
          {closed && (
            <p role="status" className="rounded-xl border bg-muted p-4">
              Брифинг передан HR. Спасибо! Можно просмотреть итог. Для уточнений
              попросите HR новое приглашение.
            </p>
          )}
          <div className="grid items-start gap-5 lg:grid-cols-3">
            <section
              className="space-y-4 rounded-2xl border bg-card p-5 lg:col-span-2"
              aria-label="Разговор с ИИ"
            >
              <div
                className="max-h-[55vh] space-y-3 overflow-y-auto"
                aria-live="polite"
              >
                {brief.intake.messages.map((item, i) => (
                  <article
                    key={i}
                    className={`rounded-xl border p-4 ${item.role === "user" ? "ml-5 bg-muted" : "mr-5"}`}
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {item.role === "user" ? "Руководитель" : "ИИ-партнёр"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{item.content}</p>
                  </article>
                ))}
                {!brief.intake.messages.length && (
                  <p>
                    Начните с того, какую задачу должен решить новый сотрудник.
                    Если HR приложил материалы, нажмите «Начать по исходным
                    данным».
                  </p>
                )}
              </div>
              {!closed && (
                <>
                  {!brief.intake.messages.length && (
                    <Button
                      variant="outline"
                      disabled={busy || brief.busy}
                      onClick={() =>
                        send(
                          "Начнём брифинг. Изучи исходные данные и уточни самое важное для профиля сотрудника.",
                        )
                      }
                    >
                      Начать по исходным данным
                    </Button>
                  )}
                  <label
                    htmlFor="external-message"
                    className="block font-medium"
                  >
                    Ваш ответ или уточнение
                  </label>
                  <Textarea
                    id="external-message"
                    rows={4}
                    value={message}
                    maxLength={5000}
                    disabled={busy || brief.busy}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Можно ответить на несколько вопросов или исправить предыдущие требования…"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy || brief.busy || message.trim().length < 2}
                      onClick={() => send(message)}
                    >
                      {busy ? "ИИ готовит ответ…" : "Отправить"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        busy ||
                        brief.busy ||
                        !brief.answers.length ||
                        Boolean(message.trim())
                      }
                      onClick={() => {
                        setSummary(true);
                        setEdits(brief.answers);
                      }}
                    >
                      Проверить итог
                    </Button>
                    {busy && requestId && (
                      <Button variant="outline" onClick={cancel}>
                        Отменить запрос
                      </Button>
                    )}
                  </div>
                  {brief.busy && !busy && (
                    <p role="status">
                      Сообщение ещё обрабатывается.{" "}
                      <button
                        className="underline"
                        onClick={() =>
                          reload().catch(() =>
                            setError("Не удалось обновить данные."),
                          )
                        }
                      >
                        Обновить
                      </button>
                    </p>
                  )}
                  {!busy &&
                    !brief.busy &&
                    brief.lastTurn &&
                    ["failed", "pending"].includes(brief.lastTurn.status) && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          send(brief.lastTurn!.message, brief.lastTurn!.id)
                        }
                      >
                        Повторить сохранённое сообщение
                      </Button>
                    )}
                </>
              )}
              {busy && (
                <p role="status" className="text-sm text-muted-foreground">
                  Обрабатываем сообщение. Оно уже сохранено: можно продолжить
                  позже.
                </p>
              )}
            </section>
            <aside className="space-y-4 rounded-2xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Что выяснили</h2>
              {!brief.answers.length && (
                <p className="text-sm text-muted-foreground">
                  Сводка появится после первых ответов.
                </p>
              )}
              {brief.answers.map((a) => (
                <div key={a.topic}>
                  <h3 className="text-sm font-semibold">
                    {briefTopics.find((t) => t.key === a.topic)?.question}
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{a.answer}</p>
                </div>
              ))}
              <h3 className="font-semibold">Открытые вопросы</h3>
              {brief.intake.openQuestions.length ? (
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {brief.intake.openQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Пока не отмечены. Проверьте итоговые требования.
                </p>
              )}
            </aside>
          </div>
          {summary && !closed && (
            <section className="space-y-4 rounded-2xl border bg-card p-5">
              <h2 className="text-xl font-semibold">
                Проверьте итог перед передачей HR
              </h2>
              {edits.map((a, i) => (
                <div key={a.topic}>
                  <label
                    className="block text-sm font-medium"
                    htmlFor={`edit-${i}`}
                  >
                    {a.question}
                  </label>
                  <Textarea
                    id={`edit-${i}`}
                    rows={3}
                    value={a.answer}
                    maxLength={5000}
                    onChange={(e) =>
                      setEdits((prev) =>
                        prev.map((v, j) =>
                          j === i ? { ...v, answer: e.target.value } : v,
                        ),
                      )
                    }
                    disabled={busy}
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      setBrief(
                        await request({
                          action: "edit",
                          answers: edits,
                          expectedVersion: brief.updatedAt,
                        }),
                      );
                      setError("");
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Не удалось сохранить.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Сохранить исправления
                </Button>
                <Button
                  disabled={
                    busy ||
                    JSON.stringify(edits) !== JSON.stringify(brief.answers)
                  }
                  onClick={finish}
                >
                  Подтвердить и передать HR
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setSummary(false)}
                >
                  Продолжить разговор
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
