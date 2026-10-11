"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

/** One scroll owner for the conversation; the composer never scrolls away. */
export function BriefingChat({
  messages,
  value,
  onChange,
  onSend,
  disabled,
  closed,
  waiting,
  pendingMessage,
  inputId,
  emptyAction,
  controls,
  className,
}: {
  messages: Message[];
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  closed?: boolean;
  waiting?: boolean;
  pendingMessage?: string;
  inputId: string;
  emptyAction?: ReactNode;
  controls?: ReactNode;
  className?: string;
}) {
  const history = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [away, setAway] = useState(false);
  const last = messages.at(-1);
  const showPending = Boolean(
    pendingMessage &&
    !(last?.role === "user" && last.content === pendingMessage),
  );
  useEffect(() => {
    const el = history.current;
    if (el && (follow.current || pendingMessage))
      el.scrollTop = el.scrollHeight;
  }, [messages.length, last?.content, pendingMessage, waiting]);

  function submit() {
    if (disabled || closed || value.trim().length < 2) return;
    follow.current = true;
    onSend();
  }
  function bubble(item: Message, key: string) {
    const user = item.role === "user";
    return (
      <article
        key={key}
        className={cn("flex", user ? "justify-end" : "justify-start")}
      >
        <div
          className={cn(
            "max-w-[88%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed",
            user ? "rounded-br-sm bg-muted" : "rounded-bl-sm bg-background",
          )}
        >
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {user ? "Вы" : "ИИ-партнёр"}
          </p>
          <p className="whitespace-pre-wrap">{item.content}</p>
        </div>
      </article>
    );
  }
  return (
    <section
      aria-label="Разговор с ИИ"
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border bg-card",
        className,
      )}
    >
      <div
        ref={history}
        role="log"
        aria-label="История чата"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5"
        onScroll={() => {
          const el = history.current!;
          const nearBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          follow.current = nearBottom;
          setAway(!nearBottom);
        }}
      >
        {!messages.length && !showPending && (
          <div className="space-y-3 py-4">
            {bubble(
              {
                role: "assistant",
                content:
                  "Расскажите, кого вы хотите нанять и какую задачу должен решить новый сотрудник. Я помогу уточнить требования и собрать профиль.",
              },
              "welcome",
            )}
            {emptyAction}
          </div>
        )}
        {messages.map((item, i) => bubble(item, String(i)))}
        {showPending &&
          bubble({ role: "user", content: pendingMessage! }, "pending")}
        {waiting && (
          <p
            role="status"
            className="flex items-center gap-2 px-4 text-sm text-muted-foreground"
          >
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            ИИ готовит ответ…
          </p>
        )}
      </div>
      {away && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mx-auto shrink-0"
          onClick={() => {
            follow.current = true;
            history.current?.scrollTo({ top: history.current.scrollHeight });
            setAway(false);
          }}
        >
          <ArrowDown aria-hidden="true" className="size-4" />К последним
          сообщениям
        </Button>
      )}
      {!closed && (
        <form
          className="shrink-0 space-y-2 border-t bg-card p-3 sm:p-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor={inputId}>
              Сообщение руководителя
            </label>
            <Textarea
              id={inputId}
              rows={2}
              value={value}
              maxLength={5000}
              disabled={disabled}
              className="max-h-36 min-h-12 resize-none overflow-y-auto"
              placeholder="Напишите сообщение…"
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Отправить"
              disabled={disabled || value.trim().length < 2}
              className="shrink-0"
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Enter — отправить · Shift+Enter — новая строка
          </p>
          {controls && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {controls}
            </div>
          )}
        </form>
      )}
    </section>
  );
}
