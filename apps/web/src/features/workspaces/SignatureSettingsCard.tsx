"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { SectionHeader, StatusPill } from "@/features/workspaces/settings-ui";
import { PencilIcon } from "@/components/ui/icons/phosphor";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSignatureSettings } from "./signature-settings-actions";
import {
  deleteSavedSignature,
  listSavedSignatures,
} from "@/features/documents/saved-signature-actions";
import { SavedVectorThumb } from "@/features/documents/VectorSignaturePreview";

type Settings = {
  nativeSignEnabled: boolean;
  remoteSignEnabled: boolean;
  savedSignaturesEnabled: boolean;
  vectorSignaturesEnabled: boolean;
  signatureOtpEnabled: boolean;
  signatureTimelineEnabled: boolean;
  signatureSecurityMode: string;
  signatureExpirationDays: number;
};

type SavedSignature =
  | { id: string; createdAt: Date; kind: "png"; dataUrl: string }
  | { id: string; createdAt: Date; kind: "vector"; vectorData: string };

const TOGGLES: Array<{
  key: "nativeSignEnabled" | "remoteSignEnabled" | "savedSignaturesEnabled" | "signatureTimelineEnabled";
  title: string;
  description: string;
}> = [
  {
    key: "nativeSignEnabled",
    title: "Self-sign",
    description: "Позвольте участникам рисовать или печатать подпись и подписывать PDF-файлы прямо на панели управления.",
  },
  {
    key: "remoteSignEnabled",
    title: "Ссылки для удаленной подписи",
    description: "Отправьте безопасную ссылку, чтобы внешний получатель мог подписать документ без учетной записи.",
  },
  {
    key: "savedSignaturesEnabled",
    title: "Сохраненные подписи",
    description: "Позвольте участникам повторно использовать сохраненную подпись вместо того, чтобы каждый раз рисовать ее.",
  },
  {
    key: "signatureTimelineEnabled",
    title: "График подписания",
    description: "Покажите график аудита (просмотрен, проверен, подписан) в подписанных документах.",
  },
];

export function SignatureSettingsCard({ settings }: { settings: Settings }) {
  const [value, setValue] = useState(settings);
  const [pending, startTransition] = useTransition();

  function toggle(key: keyof Settings) {
    setValue((current) => ({ ...current, [key]: !current[key] }));
  }

  function save() {
    startTransition(async () => {
      const result = await saveSignatureSettings(value);
      if (!result.ok) toast.error(result.error);
      else toast.success("Настройки подписи сохранены.");
    });
  }

  return (
    <div className="space-y-6">
      <Card className="gap-5 p-6">
        <SectionHeader
          icon={PencilIcon}
          title={"Харли Подпись"}
          description={"Управляйте тем, какие собственные возможности подписи доступны для этой рабочей области. Собственная подпись соответствует требованиям и не заменяет вашу юридическую политику."}
          badge={
            <StatusPill tone={value.nativeSignEnabled ? "on" : "off"}>
              {value.nativeSignEnabled ? "Активные" : "Отключено"}
            </StatusPill>
          }
        />

        <div className="divide-y divide-border/70 rounded-xl border border-border/70">
          {TOGGLES.map((item) => (
            <label
              key={item.key}
              className="flex items-start justify-between gap-4 px-4 py-3.5"
            >
              <span>
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <Switch
                checked={value[item.key]}
                onCheckedChange={() => toggle(item.key)}
              />
            </label>
          ))}
          <label className="flex items-start justify-between gap-4 px-4 py-3.5">
            <span>
              <span className="block text-sm font-medium">
                {"Требовать OTP по электронной почте для удаленного подписания "}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                {"Получатели должны подтвердить одноразовый код, отправленный на их электронную почту, прежде чем подписывать удаленную ссылку. "}</span>
            </span>
            <Switch
              checked={value.signatureOtpEnabled}
              onCheckedChange={() => toggle("signatureOtpEnabled")}
            />
          </label>
        </div>

        <div className="max-w-xs space-y-2">
          <Label htmlFor="signature-expiration">
            {"Срок действия удаленной ссылки (дни) "}</Label>
          <Input
            id="signature-expiration"
            type="number"
            min={1}
            max={365}
            value={value.signatureExpirationDays}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                signatureExpirationDays: Number(event.target.value),
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            {"По умолчанию — 30 дней. Максимум — 365 дней. "}</p>
        </div>

        <div>
          <Button onClick={save} disabled={pending}>
            {pending ? "Сохранение…" : "Сохранить настройки"}
          </Button>
        </div>
      </Card>

      {value.savedSignaturesEnabled ? <SavedSignaturesCard /> : null}
    </div>
  );
}

function SavedSignaturesCard() {
  const [signatures, setSignatures] = useState<SavedSignature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listSavedSignatures()
      .then((rows) => setSignatures(rows))
      .finally(() => setLoading(false));
  }, []);

  function remove(id: string) {
    void deleteSavedSignature({ id }).then((result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось удалить подпись.");
        return;
      }
      setSignatures((current) => current.filter((item) => item.id !== id));
      toast.success("Подпись удалена");
    });
  }

  return (
    <Card className="gap-4 p-6">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {"Ваши сохраненные подписи "}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {"Здесь отображаются подписи, которые вы сохраняете при подписании документа. Они являются личными для вашей учетной записи и могут использоваться повторно в каждом документе. "}</p>
      </div>
      <CardContent className="px-0">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : signatures.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm leading-6 text-muted-foreground">
            {"Сохраненных подписей пока нет. Сохраните его на экране подписи в следующий раз, когда будете подписывать документ. "}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {signatures.map((signature) => (
              <div key={signature.id} className="group relative">
                <div className="flex h-20 items-center justify-center rounded-lg border border-input bg-white p-2">
                  {signature.kind === "vector" ? (
                    <SavedVectorThumb vectorData={signature.vectorData} />
                  ) : (
                    <img
                      src={signature.dataUrl}
                      alt={"Сохраненная подпись"}
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                </div>
                <button
                  type="button"
                  aria-label={"Удалить сохраненную подпись"}
                  onClick={() => remove(signature.id)}
                  className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground opacity-0 shadow-xs transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
