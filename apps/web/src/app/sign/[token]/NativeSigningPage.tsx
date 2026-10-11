"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, PenLine } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PdfFieldFiller, type FillableField } from "@/features/documents/PdfFieldFiller";
import { SignaturePad } from "@/features/documents/SignaturePad";
import type { VectorSignatureData } from "@/features/documents/signature-vector";

const emptyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export function NativeSigningPage({ token }: { token: string }) {
  const [meta, setMeta] = useState<{
    documentName: string;
    recipientName: string;
    routingOrder: number;
    signerCount: number;
    securityMode: string;
    requiresOtp: boolean;
  } | null>(null);
  const [signature, setSignature] = useState("");
  const [vectorSignature, setVectorSignature] = useState<VectorSignatureData | null>(null);
  const [consent, setConsent] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signed, setSigned] = useState(false);
  const [fields, setFields] = useState<FillableField[] | null>(null);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetch(`/api/native-sign/${token}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error("This signing link is invalid or expired.");
        return response.json();
      })
      .then((value) => {
        setMeta(value);
        setVerified(!value.requiresOtp);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!verified) return;
    void fetch(`/api/native-sign/${token}/fields`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setFields(Array.isArray(data.fields) ? data.fields : []))
      .catch(() => setFields([]));
  }, [token, verified]);

  async function requestOtp() {
    const response = await fetch(`/api/native-sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request_otp" }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      toast.error(result.error ?? "Не удалось отправить код.");
      return;
    }
    setChallengeId(result.challengeId);
    toast.success("Код подтверждения отправлен по электронной почте.");
  }

  async function verifyOtp() {
    const response = await fetch(`/api/native-sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_otp", challengeId, code: otp }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      toast.error(result.error ?? "Неверный код.");
      return;
    }
    setVerified(true);
    toast.success("Электронная почта подтверждена.");
  }

  const requiredTextFieldsFilled =
    fields?.filter((f) => f.type === "text" && f.required).every((f) => (textValues[f.id] ?? "").trim().length > 0) ?? false;
  const canSubmit = Boolean(vectorSignature?.compressed) && consent && fields !== null && fields.length > 0 && requiredTextFieldsFilled;

  async function submit() {
    if (!canSubmit) {
      toast.error("Заполните все поля, добавьте свою подпись и сначала подтвердите согласие.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/native-sign/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureVectorBase64: vectorSignature?.compressed,
          textValues,
          consentAt: new Date().toISOString(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.error ?? "Не удалось завершить подписание.");
        return;
      }
      setSigned(true);
      toast.success("Документ успешно подписан.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-2xl items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          {"Загрузка ссылки для подписи… "}</p>
      </main>
    );

  if (signed)
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 p-8 text-center duration-500 animate-in fade-in slide-in-from-bottom-2">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          {"Документ подписан "}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {"Спасибо, "}{meta?.recipientName}. A copy of the signed document will be
          available to the sender shortly. You can close this window.
        </p>
      </main>
    );

  if (!meta)
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center p-8">
        <div className="w-full rounded-2xl border border-border/70 bg-card p-6 text-center shadow-xs">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            {"Ссылка для подписи недоступна "}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {"Возможно, срок действия этой ссылки истек, она уже использовалась или была отменена. "}</p>
        </div>
      </main>
    );

  return (
    <main className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">
      <header className="flex items-center gap-3 border-b border-border/70 pb-3 duration-500 animate-in fade-in slide-in-from-top-1">
        <div className="flex items-center gap-2">
          <PenLine className="size-4 shrink-0 text-primary" />
          <h1 className="shrink-0 font-display text-base font-semibold tracking-tight">
            {"Рассмотрите и подпишите "}</h1>
          <span className="text-muted-foreground/50" aria-hidden>
            /
          </span>
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {meta.documentName}
          </p>
        </div>
        <span className="ml-auto hidden shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:block">
          {"подписывающая сторона "}{meta.routingOrder} {"из "}{meta.signerCount}
        </span>
      </header>

      {meta.requiresOtp && !verified ? (
        <section className="mx-auto max-w-md space-y-4 rounded-2xl border border-border/70 bg-card p-6 shadow-xs duration-500 animate-in fade-in slide-in-from-bottom-2">
          <h2 className="font-semibold">{"Подтвердите свой адрес электронной почты"}</h2>
          <p className="text-sm text-muted-foreground">
            {"Мы отправим одноразовый код на адрес электронной почты, выбранный отправителем. "}</p>
          {challengeId ? (
            <>
              <Label htmlFor="otp">{"Код подтверждения"}</Label>
              <Input
                id="otp"
                inputMode="numeric"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder="123456"
              />
              <Button onClick={verifyOtp} disabled={otp.length !== 6}>
                {"Подтвердить код "}</Button>
            </>
          ) : (
            <Button onClick={requestOtp}>{"Отправить код подтверждения"}</Button>
          )}
        </section>
      ) : (
        <div className="grid gap-5 duration-500 animate-in fade-in slide-in-from-bottom-2 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 rounded-2xl border border-border/70 bg-muted/30 p-3 shadow-xs sm:p-4">
            <PdfFieldFiller
              fileUrl={`/api/native-sign/${token}/document`}
              fields={fields ?? []}
              signatureDataUrl={signature || emptyPng}
              hasSignature={Boolean(signature)}
              textValues={textValues}
              maxPageWidth={960}
              onTextValueChange={(fieldId, value) =>
                setTextValues((prev) => ({ ...prev, [fieldId]: value }))
              }
            />
          </div>
          <section className="flex h-fit flex-col gap-5 rounded-2xl border border-border/70 bg-card p-5 shadow-xs lg:sticky lg:top-5">
            <div>
              <p className="text-sm font-semibold">{"Ваша подпись"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {"Нарисуйте или введите свою подпись — она заполняет все поля для подписи в документе. "}</p>
            </div>
            <SignaturePad onChange={setSignature} onVectorChange={setVectorSignature} />
            <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
              <Checkbox
                checked={consent}
                onCheckedChange={(value) => setConsent(value === true)}
              />
              <span>
                <span className="block font-medium">{"Подтвердите намерение подписать"}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {"Я подтверждаю, что это моя подпись, и согласен подписать этот документ в электронном виде. "}</span>
              </span>
            </label>
            <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-accent/40 p-3 text-xs leading-5 text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                {"Ваше намерение подписи, согласие, хеш документа, временная метка, значения полей и целостность артефакта записываются. "}</p>
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={submitting || !canSubmit}
              onClick={submit}
            >
              {submitting ? "Подписание…" : "Подписать документ"}
            </Button>
          </section>
        </div>
      )}
    </main>
  );
}
