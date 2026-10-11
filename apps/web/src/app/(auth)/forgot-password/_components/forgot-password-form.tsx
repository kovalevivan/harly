"use client";

import { localizeSystemText } from "@/lib/localize-system-text";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { AuthSpinner } from "../../_components/auth-methods";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Введите свой адрес электронной почты.");
      return;
    }

    setIsPending(true);
    try {
      await authClient.requestPasswordReset({
        email: trimmedEmail,
        redirectTo: "/reset-password",
      });
      // Always report success , never reveal whether the account exists.
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setIsPending(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-stagger space-y-4">
        <p className="text-sm leading-6 text-foreground">
          {"Если существует учетная запись для"}{" "}
          <span className="font-medium">{email.trim()}</span>{", мы отправили ссылку для сброса пароля. Проверьте свой почтовый ящик. "}</p>
        <p className="text-sm text-muted-foreground">
          {"Не понял? Проверьте спам или"}{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline"
          >
            {"попробуй еще раз "}</button>
          .
        </p>
      </div>
    );
  }

  return (
    <form className="auth-stagger space-y-6" onSubmit={requestReset}>
      <div>
        <label
          htmlFor="email"
          className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          {"Адрес электронной почты "}</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="you@company.com"
          className="auth-field mt-2 w-full border-0 border-b border-input bg-transparent pb-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
      </div>

      {error ? <p className="text-center text-sm text-danger-rust">{localizeSystemText(error)}</p> : null}

      <button
        type="submit"
        autoComplete="off"
        disabled={isPending || !email.trim() ? true : undefined}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--pine-strong)] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
      >
        {isPending ? (
          <>
            <AuthSpinner />
            <span>{"Отправка…"}</span>
          </>
        ) : (
          <span>{"Отправить ссылку для сброса"}</span>
        )}
      </button>
    </form>
  );
}
