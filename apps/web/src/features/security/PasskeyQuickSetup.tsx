"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { toast } from "@/lib/notification-island/toast";

import {
  FingerPrintDuotoneIcon,
  SpinnerIcon,
  CheckIcon,
} from "@/components/ui/icons/phosphor";
import { Button } from "@/components/ui/button";

/**
 * Compact passkey enrollment used in the onboarding security step, offered
 * alongside TOTP two-factor as a passwordless alternative. Reuses the same
 * /api/passkey/register endpoints as the full settings card.
 */
export function PasskeyQuickSetup() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRegister() {
    startTransition(async () => {
      try {
        const optRes = await fetch("/api/passkey/register");
        if (!optRes.ok) throw new Error("Failed to start passkey setup");
        const { challengeId, ...options } = await optRes.json();

        const attestation = await startRegistration({ optionsJSON: options });

        const verRes = await fetch("/api/passkey/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId, response: attestation, name: "Passkey" }),
        });
        if (!verRes.ok) {
          const err = await verRes.json();
          throw new Error(err.error ?? "Не удалось настроить ключ доступа");
        }

        toast.success("Ключ доступа зарегистрирован");
        setDone(true);
        router.refresh();
      } catch (err: unknown) {
        // User dismissed the browser dialog , not an error.
        if (err instanceof Error && err.name === "NotAllowedError") return;
        toast.error(err instanceof Error ? err.message : "Не удалось настроить ключ доступа");
      }
    });
  }

  if (done) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-pine/20 bg-sage/30 px-4 py-3">
        <CheckIcon className="size-4 text-pine" />
        <p className="text-sm font-medium text-foreground">{"Добавлен пароль."}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3.5">
      <span className="flex items-start gap-3">
        <FingerPrintDuotoneIcon className="mt-0.5 size-5 text-pine" />
        <span>
          <span className="block text-sm font-medium text-foreground">
            {"Установить пароль "}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {"Войдите в систему с помощью отпечатка пальца, лица или ключа безопасности. Пароль не требуется. "}</span>
        </span>
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleRegister}
        disabled={isPending}
      >
        {isPending ? (
          <SpinnerIcon className="mr-1.5 size-3.5" />
        ) : (
          <FingerPrintDuotoneIcon className="mr-1.5 size-3.5" />
        )}
        {"Добавить ключ доступа "}</Button>
    </div>
  );
}
