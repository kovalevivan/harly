"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BriefingChat } from "./BriefingChat";
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
  const [pendingMessage, setPendingMessage] = useState<string>();
  const [summary, setSummary] = useState(false);
  const [edits, setEdits] = useState<BriefAnswer[]>([]);
  const activeRequest = useRef<AbortController | null>(null);
  const endpoint = `/api/public/briefing/${inviteId}`;
  async function request(body?: object, signal?: AbortSignal) {
    const response = await fetch(
      endpoint,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal,
          }
        : { cache: "no-store", signal },
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
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    setRequestId(id);
    setPendingMessage(text);
    setError("");
    try {
      setBrief(
        await request(
          {
            action: "message",
            message: text,
            requestId: id,
            expectedVersion: brief.updatedAt,
          },
          controller.signal,
        ),
      );
      setMessage("");
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Не удалось получить ответ.");
      try {
        await reload();
      } catch {
        /* Preserve the draft while offline. */
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setBusy(false);
        setRequestId(null);
        setPendingMessage(undefined);
      }
    }
  }
  async function cancel() {
    if (!requestId) return;
    try {
      setBrief(await request({ action: "cancel", requestId }));
      activeRequest.current?.abort();
      activeRequest.current = null;
      setBusy(false);
      setRequestId(null);
      setPendingMessage(undefined);
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
    <main className="mx-auto flex h-dvh max-w-6xl flex-col gap-3 overflow-hidden px-3 py-3 sm:gap-4 sm:px-6 sm:py-5">
      <header className="shrink-0">
        <p className="text-sm text-muted-foreground">
          Harly · Брифинг руководителя
        </p>
        <h1 className="mt-1 truncate text-xl font-semibold sm:text-2xl">
          {brief?.title || "Требования к сотруднику"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Расскажите, кого ищете. ИИ уточнит требования, а итог вы проверите
          перед передачей HR.
        </p>
      </header>
      {loading && <p role="status">Открываем брифинг…</p>}
      {error && (
        <p
          role="alert"
          className="shrink-0 rounded-xl border bg-muted p-3 text-sm"
        >
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
            <p
              role="status"
              className="shrink-0 rounded-xl border bg-muted p-3 text-sm"
            >
              Брифинг передан HR. Спасибо! Можно просмотреть итог. Для уточнений
              попросите HR новое приглашение.
            </p>
          )}
          {!summary && (
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
              <BriefingChat
                className="h-full lg:col-span-2"
                messages={brief.intake.messages}
                value={message}
                onChange={setMessage}
                onSend={() => void send(message)}
                disabled={busy || brief.busy}
                closed={closed}
                waiting={Boolean(requestId) || brief.busy}
                pendingMessage={pendingMessage}
                inputId="external-message"
                emptyAction={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || brief.busy}
                    onClick={() =>
                      send(
                        "Начнём брифинг. Изучи исходные данные и уточни самое важное для профиля сотрудника.",
                      )
                    }
                  >
                    Начать по исходным данным
                  </Button>
                }
                controls={
                  <>
                    <Button
                      type="button"
                      size="sm"
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
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={cancel}
                      >
                        Отменить запрос
                      </Button>
                    )}
                    {brief.busy && !busy && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          reload().catch(() =>
                            setError("Не удалось обновить данные."),
                          )
                        }
                      >
                        Обновить ответ
                      </Button>
                    )}
                    {!busy &&
                      !brief.busy &&
                      brief.lastTurn &&
                      ["failed", "pending"].includes(brief.lastTurn.status) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            send(brief.lastTurn!.message, brief.lastTurn!.id)
                          }
                        >
                          Повторить сохранённое сообщение
                        </Button>
                      )}
                  </>
                }
              />
              <aside className="hidden min-h-0 space-y-4 overflow-y-auto rounded-2xl border bg-card p-5 lg:block">
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
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {a.answer}
                    </p>
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
          )}
          {closed && (
            <Button
              variant="outline"
              onClick={() => {
                setSummary(!summary);
                setEdits(brief.answers);
              }}
            >
              {summary ? "Вернуться к разговору" : "Посмотреть итог"}
            </Button>
          )}
          {summary && (
            <section className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl border bg-card p-5">
              <h2 className="text-xl font-semibold">
                {closed
                  ? "Требования переданы HR"
                  : "Проверьте итог перед передачей HR"}
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
                    disabled={busy || closed}
                  />
                </div>
              ))}
              {brief.intake.openQuestions.length > 0 && (
                <div>
                  <h3 className="font-medium">Открытые вопросы</h3>
                  <ul className="list-disc space-y-2 pl-5 text-sm">
                    {brief.intake.openQuestions.map((question, i) => (
                      <li key={i}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-card py-3">
                {!closed && (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy || closed}
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
                        closed ||
                        JSON.stringify(edits) !== JSON.stringify(brief.answers)
                      }
                      onClick={finish}
                    >
                      Подтвердить и передать HR
                    </Button>
                  </>
                )}
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
