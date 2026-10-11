"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";

import { SectionHeader, StatusPill } from "@/features/workspaces/settings-ui";
import { UsersThreeDuotoneIcon } from "@/components/ui/icons/phosphor";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toggleForce2FAAction } from "@/features/security/actions";
import { ensureSensitiveActionReauth } from "./reauth-client";

export function Force2FACard({
  enabled,
  isOwner,
}: {
  enabled: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle(value: boolean) {
    startTransition(async () => {
      let result;
      try {
        await ensureSensitiveActionReauth();
        result = await toggleForce2FAAction(value);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Повторная аутентификация не удалась.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить настройку.");
        return;
      }
      toast.success(
        value
          ? "2FA теперь требуется для всех участников."
          : "Требование 2FA удалено.",
      );
      router.refresh();
    });
  }

  return (
    <Card className="gap-5 p-6">
      <SectionHeader
        icon={UsersThreeDuotoneIcon}
        title={"Принудительно использовать 2FA для всех участников"}
        description={"Если этот параметр включен, все участники рабочей области должны настроить двухфакторную аутентификацию перед доступом к панели мониторинга."}
        badge={
          <StatusPill tone={enabled ? "on" : "off"}>
            {enabled ? "Требуется" : "Необязательно"}
          </StatusPill>
        }
        action={
          isOwner ? (
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={isPending}
              aria-label={"Требовать 2FA для всех участников"}
            />
          ) : null
        }
      />

      {!isOwner && (
        <p className="text-xs text-muted-foreground">
          {"Изменить этот параметр могут только владельцы рабочей области. "}</p>
      )}

      {enabled && (
        <div className="rounded-xl border border-clay/20 bg-clay/5 px-4 py-3 text-sm text-clay">
          {"Участникам без 2FA будет предложено включить его при следующем входе в систему. "}</div>
      )}
    </Card>
  );
}
