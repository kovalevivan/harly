"use client";

import { useState, useTransition } from "react";
import { toast } from "@/lib/notification-island/toast";
import {
  setWorkspaceAutomationEnabledAction,
} from "./actions";
import type { WorkspaceAutomationPolicySnapshot } from "./data";

export function WorkspaceAutomationControls({
  initialPolicy,
}: {
  initialPolicy: WorkspaceAutomationPolicySnapshot;
}) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const enabled = policy.enabled;

  function updateEnabled(nextEnabled: boolean) {
    const trimmed = reason.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await setWorkspaceAutomationEnabledAction({
        enabled: nextEnabled,
        reason: trimmed,
      });
      if (!result.ok || !result.policy) {
        toast.error(result.error ?? "Не удалось обновить средства автоматизации рабочей области.");
        return;
      }
      setPolicy(result.policy);
      setReason("");
      toast.success(
        nextEnabled ? "Автоматизация рабочего пространства возобновилась." : "Автоматизация рабочего пространства приостановлена.",
      );
    });
  }

  return (
    <section
      aria-labelledby="workspace-automation-policy-title"
      className="mx-auto mb-6 w-full max-w-5xl rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="workspace-automation-policy-title" className="text-base font-semibold text-near-ink">
            {"Средства автоматизации рабочего пространства "}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {"Ограничения рабочего пространства: "}{policy.maxRunsPerMinute} {"новые пробеги и "}{policy.maxExternalActionsPerMinute} {"внешних действий в минуту, до "}{policy.maxConcurrentRuns} {"активные пробежки. "}</p>
          <p role="status" aria-live="polite" className="mt-2 text-sm font-medium">
            {"Автоматизация "}{enabled ? "enabled" : "paused"} {"для этого рабочего пространства. "}</p>
          {!enabled && policy.pausedAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              {"Приостановлено "}{new Date(policy.pausedAt).toLocaleString("ru-RU")}
              {policy.pausedById ? ` на ${policy.pausedById}` : ""}.
              {policy.pauseReason ? ` Reason: ${policy.pauseReason}` : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => updateEnabled(!enabled)}
          disabled={pending || !reason.trim()}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-near-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Сохранение…" : enabled ? "Приостановить автоматизацию рабочего пространства" : "Возобновить автоматизацию рабочего пространства"}
        </button>
      </div>
      <div className="mt-4 max-w-2xl">
        <label
          htmlFor="workspace-automation-reason"
          className="mb-1 block text-sm font-medium text-near-ink"
        >
          {"Причина этого изменения "}</label>
        <textarea
          id="workspace-automation-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          required
          rows={2}
          aria-describedby="workspace-automation-reason-help"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-near-ink"
        />
        <p id="workspace-automation-reason-help" className="mt-1 text-xs text-muted-foreground">
          {"Требуется для паузы и возобновления; до 500 символов. "}</p>
      </div>
    </section>
  );
}
