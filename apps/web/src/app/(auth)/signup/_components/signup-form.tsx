"use client";

import { localizeSystemText } from "@/lib/localize-system-text";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import {
  AuthMethodsRow,
  AuthSpinner,
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
} from "../../_components/auth-methods";

export function SignupForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<null | "email" | "google">(null);
  const [leaving, setLeaving] = useState(false);

  const canSubmit =
    name.trim() && email.trim() && password.length >= 8 && confirmPassword;
  const isBusy = pending !== null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) { setError("Требуется полное имя."); return; }
    if (!trimmedEmail) { setError("Требуется электронная почта."); return; }
    if (password.length < 8) { setError("Пароль должен быть не менее 8 символов."); return; }
    if (password !== confirmPassword) { setError("Пароли не совпадают."); return; }

    setPending("email");
    try {
      const result = await authClient.signUp.email({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });
      if (result.error) {
        setError(result.error.message ?? "Невозможно создать учетную запись.");
        return;
      }
      // Play a brief exit before the hard navigation to onboarding so the
      // handoff feels continuous instead of snapping to a blank reload.
      setLeaving(true);
      setTimeout(() => window.location.replace("/onboarding"), 300);
    } finally {
      setPending(null);
    }
  }

  async function continueWithGoogle() {
    setError(null);
    setPending("google");
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/onboarding",
      });
      if (result.error) {
        setError("Невозможно продолжить работу с Google.");
        setPending(null);
      }
    } catch {
      setError("Невозможно продолжить работу с Google.");
      setPending(null);
    }
  }

  return (
    <div className={`auth-stagger space-y-7 ${leaving ? "auth-leaving" : ""}`}>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <Field
          id="name"
          label={"Полное имя"}
          type="text"
          autoComplete="name"
          autoFocus
          value={name}
          placeholder={"Ада Лавлейс"}
          onChange={(v) => { setName(v); setError(null); }}
        />

        <Field
          id="email"
          label={"Адрес электронной почты"}
          type="email"
          autoComplete="email"
          value={email}
          placeholder="you@company.com"
          onChange={(v) => { setEmail(v); setError(null); }}
        />

        <div>
          <label
            htmlFor="password"
            className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            {"Пароль "}</label>
          <div className="relative mt-2">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder={"Минимум 8 символов"}
              className="auth-field w-full border-0 border-b border-input bg-transparent pb-2.5 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-0 top-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            {"Подтвердите пароль "}</label>
          <div className="relative mt-2">
            <input
              id="confirm-password"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
              placeholder={"Повторите свой пароль"}
              className="auth-field w-full border-0 border-b border-input bg-transparent pb-2.5 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-0 top-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showConfirm ? "Скрыть пароль" : "Показать пароль"}
            >
              {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {error ? <p className="text-center text-sm text-danger-rust">{localizeSystemText(error)}</p> : null}

        <button
          type="submit"
          autoComplete="off"
          disabled={isBusy || !canSubmit ? true : undefined}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--pine-strong)] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {pending === "email" ? (
            <>
              <AuthSpinner />
              <span>{"Создание аккаунта…"}</span>
            </>
          ) : (
            <span>{"Продолжить"}</span>
          )}
        </button>
      </form>

      {googleEnabled ? (
        <>
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {"или "}<div className="h-px flex-1 bg-border" />
          </div>

          <AuthMethodsRow
            methods={[
              {
                id: "google",
                label: "Гугл",
                icon: <GoogleIcon />,
                onSelect: continueWithGoogle,
                loading: pending === "google",
              },
            ]}
            disabled={isBusy}
          />
        </>
      ) : null}
    </div>
  );
}

/** Shared borderless underline field used across the signup form. */
function Field({
  id,
  label,
  type,
  value,
  placeholder,
  autoComplete,
  autoFocus,
  onChange,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  placeholder: string;
  autoComplete?: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="auth-field mt-2 w-full border-0 border-b border-input bg-transparent pb-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
      />
    </div>
  );
}
