"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import { completeForcedPasswordChangeAction } from "@/features/security/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpinnerIcon } from "@/components/ui/icons/phosphor";

export function ChangePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;

  function submit() {
    if (password.length < 8 || password !== confirm) return;
    startTransition(async () => {
      const res = await completeForcedPasswordChangeAction({ password });
      if (!res.ok) {
        toast.error(res.error ?? "Не удалось сменить пароль.");
        return;
      }
      toast.success("Пароль обновлен.");
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cp-new">{"Новый пароль"}</Label>
        <Input
          id="cp-new"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          autoFocus
        />
        {tooShort ? (
          <p className="text-xs text-destructive">{"Используйте не менее 8 символов."}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="cp-confirm">{"Подтвердите пароль"}</Label>
        <Input
          id="cp-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoComplete="new-password"
        />
        {mismatch ? (
          <p className="text-xs text-destructive">{"Пароли не совпадают."}</p>
        ) : null}
      </div>
      <Button
        className="w-full"
        size="lg"
        onClick={submit}
        disabled={isPending || password.length < 8 || password !== confirm}
      >
        {isPending && <SpinnerIcon className="mr-1.5 size-4" />}
        {"Установить новый пароль "}</Button>
    </div>
  );
}
