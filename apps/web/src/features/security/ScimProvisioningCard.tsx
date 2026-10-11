"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";
import { Copy, KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader, StatusPill } from "@/features/workspaces/settings-ui";
import { createScimTokenAction, revokeScimTokenAction, type ScimTokenSummary } from "@/features/security/scim-actions";

export function ScimProvisioningCard({ tokens, workspaceId, isOwner }: { tokens: ScimTokenSummary[]; workspaceId: string; isOwner: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function create() {
    startTransition(async () => {
      const result = await createScimTokenAction({ name, expiresAt: expiresAt || undefined });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось создать токен.");
        return;
      }
      setName(""); setExpiresAt(""); setNewToken(result.token ?? null); router.refresh();
      toast.success("Токен SCIM создан. Скопируйте его сейчас; оно больше не будет показано.");
    });
  }
  return (
    <Card className="gap-5 p-6">
      <SectionHeader icon={KeyRound} title={"Предоставление SCIM"} description={"Автоматически предоставляйте и деактивируйте участников от вашего поставщика удостоверений."} badge={<StatusPill tone={tokens.some((t) => !t.revokedAt) ? "on" : "off"}>{tokens.some((t) => !t.revokedAt) ? "Настроен" : "Не настроено"}</StatusPill>} />
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
        {"Адрес API: "}<code className="text-foreground">/api/scim/v2.0/{workspaceId}/Users</code>
      </div>
      {newToken ? (
        <div className="space-y-2 rounded-xl border border-clay/30 bg-clay/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-clay"><ShieldAlert className="size-4" />{"Скопируйте этот токен сейчас"}</div>
          <div className="flex gap-2"><Input readOnly value={newToken} className="font-mono text-xs" /><Button type="button" variant="outline" onClick={() => { void navigator.clipboard.writeText(newToken); toast.success("Токен скопирован."); }}><Copy className="size-4" /></Button></div>
        </div>
      ) : null}
      {isOwner ? <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <div className="space-y-2"><Label htmlFor="scim-token-name">{"Имя токена"}</Label><Input id="scim-token-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={"Окта продакшн"} /></div>
        <div className="space-y-2"><Label htmlFor="scim-token-expiry">{"Срок действия истекает"}</Label><Input id="scim-token-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>
        <Button type="button" onClick={create} disabled={pending || !name.trim()}><Plus className="size-4" />{"Создать токен"}</Button>
      </div> : null}
      <div className="divide-y rounded-xl border border-border/70">
      {tokens.map((token) => <div key={token.id} className="flex items-center gap-3 px-4 py-3 text-sm"><span className="min-w-0 flex-1"><span className="font-medium">{token.name}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{token.tokenPrefix}…</span><span className="block text-xs text-muted-foreground">{token.revokedAt ? "Отозван" : token.lastUsedAt ? `Последнее использование ${token.lastUsedAt.toLocaleString("ru-RU")}` : "Никогда не использовался"}</span></span>{isOwner && !token.revokedAt ? <Button type="button" size="icon" variant="ghost" className="text-destructive" aria-label={`Отозвать ${token.name}`} onClick={() => startTransition(async () => { const result = await revokeScimTokenAction(token.id); if (!result.ok) { toast.error(result.error); return; } toast.success("Токен SCIM отозван."); router.refresh(); })}><Trash2 className="size-4" /></Button> : null}</div>)}
        {tokens.length === 0 ? <p className="px-4 py-5 text-sm text-muted-foreground">{"Токены SCIM не были созданы."}</p> : null}
      </div>
    </Card>
  );
}
