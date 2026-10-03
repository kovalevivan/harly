"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/lib/notification-island/toast";

import { saveOfferSignatureChannelAction } from "@/features/workspaces/esign-settings-actions";
import type { WorkspaceEsignStatus } from "@/lib/esign/config";
import { IntegrationHeader } from "@/features/workspaces/IntegrationDetailShell";
import { PencilIcon, GearSixIcon } from "@/components/ui/icons/phosphor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Harly's built-in native signing — no connection to make, so this panel is
 * purely offer-channel configuration + a link to the deeper native-sign
 * settings (OTP, remote links, evidence) at /settings/signature.
 */
export function HarlySignConnectPanel({
  status,
  canEdit,
  tileClassName,
  description,
  docusealConnected,
}: {
  status: WorkspaceEsignStatus;
  canEdit: boolean;
  tileClassName: string;
  description: string;
  docusealConnected: boolean;
}) {
  const router = useRouter();
  const [savingChannel, startSaveChannel] = useTransition();

  function setChannel(channel: "email" | "esign" | "native") {
    startSaveChannel(async () => {
      const result = await saveOfferSignatureChannelAction(channel);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить настройки подписи предложения.");
        return;
      }
      toast.success(
        channel === "esign"
          ? "DocuSeal включен для предложений"
          : channel === "native"
            ? "Встроенная подпись включена для предложений"
            : "Электронная почта включена для предложений",
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <IntegrationHeader
      logo={PencilIcon}
        tileClassName={tileClassName}
        name="Harly Sign"
        description={description}
        statusLabel="Connected"
        statusTone="on"
        action={
          <Button variant="outline" asChild>
            <Link href="/settings/signature">
              <GearSixIcon className="size-4" />
              {"Настройки подписи "}</Link>
          </Button>
        }
      />

      {canEdit ? (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">{"Предложить доставку подписи"}</h2>
            <p className="text-sm text-muted-foreground">{"Выберите, как кандидаты будут получать предложения по умолчанию."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={status.offerSignatureChannel === "email" ? "default" : "outline"} disabled={savingChannel} onClick={() => setChannel("email")}>{"Электронная почта"}</Button>
            <Button variant={status.offerSignatureChannel === "native" ? "default" : "outline"} disabled={savingChannel} onClick={() => setChannel("native")}>{"Родной (встроенный)"}</Button>
            <Button
              variant={status.offerSignatureChannel === "esign" ? "default" : "outline"}
              disabled={savingChannel || !docusealConnected}
              title={docusealConnected ? undefined : "Сначала подключите DocuSeal"}
              onClick={() => setChannel("esign")}
            >
              DocuSeal{docusealConnected ? "" : " (не подключен)"}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
