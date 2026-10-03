"use client";

import { localizeSystemText } from "@/lib/localize-system-text";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import { authClient } from "@/lib/auth-client";
import { acceptWorkspaceInvitationAction } from "@/features/workspaces/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Invite-scoped account setup. A new teammate accepting an invitation only sets
 * a name + password (their email is fixed to the invite), then lands straight
 * in the workspace with the role the admin chose , no org creation, no generic
 * onboarding wizard.
 */
export function InviteOnboard({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = name.trim().length > 0 && password.length >= 8;

  function submit() {
    setError(null);
    startTransition(async () => {
      const signUp = await authClient.signUp.email({
        name: name.trim(),
        email,
        password,
      });
      if (signUp.error) {
        setError(signUp.error.message ?? "Не удалось создать учетную запись.");
        return;
      }

      const accepted = await acceptWorkspaceInvitationAction(invitationId);
      if (!accepted.success || !accepted.organizationId) {
        setError(accepted.error ?? "Не удалось присоединиться к рабочей области.");
        return;
      }

      await authClient.organization.setActive({
        organizationId: accepted.organizationId,
      });

      toast.success("Добро пожаловать на борт");
      router.replace("/onboarding");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="invite-email">{"Электронная почта"}</Label>
        <Input id="invite-email" value={email} disabled readOnly />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-name">{"Полное имя"}</Label>
        <Input
          id="invite-name"
          value={name}
          autoFocus
          autoComplete="name"
          placeholder={"Ада Лавлейс"}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-password">{"Пароль"}</Label>
        <Input
          id="invite-password"
          type="password"
          value={password}
          autoComplete="new-password"
          placeholder={"Минимум 8 символов"}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) submit();
          }}
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {localizeSystemText(error)}
        </p>
      ) : null}

      <Button
        size="lg"
        className="w-full"
        disabled={!canSubmit || isPending}
        onClick={submit}
      >
        {isPending ? "Настройка…" : "Присоединяйтесь и начните работать"}
      </Button>
    </div>
  );
}
