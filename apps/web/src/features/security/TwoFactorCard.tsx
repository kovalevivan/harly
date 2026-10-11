"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "@/lib/notification-island/toast";

import { authClient } from "@harly/auth/client";
import { SectionHeader, StatusPill } from "@/features/workspaces/settings-ui";
import {
  DeviceMobileDuotoneIcon,
  CheckIcon,
  SpinnerIcon,
  CopyIcon,
  DownloadDuotoneIcon,
} from "@/components/ui/icons/phosphor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "idle" | "password" | "configure" | "done" | "disable";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Single-tenant deployments serve the app from the workspace's own domain, so
 *  the browser hostname doubles as a stable authenticator issuer label. */
function currentIssuer(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.hostname || undefined;
}

export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setStep("idle");
    setTotpUri("");
    setBackupCodes([]);
    setOtp("");
    setPassword("");
  }

  // Step 1: call enable({password}) → get URI + backup codes
  function handleEnable() {
    startTransition(async () => {
      const res = await authClient.twoFactor.enable({
        password,
        issuer: currentIssuer(),
      });
      if (res.error) {
        toast.error(res.error.message ?? "Неверный пароль");
        return;
      }
      const data = res.data as { totpURI?: string; backupCodes?: string[] } | null;
      setTotpUri(data?.totpURI ?? "");
      setBackupCodes(data?.backupCodes ?? []);
      setPassword("");
      setStep("configure");
    });
  }

  // Step 2: call verifyTotp({code}) → twoFactorEnabled = true
  function handleVerify() {
    startTransition(async () => {
      const res = await authClient.twoFactor.verifyTotp({ code: otp });
      if (res.error) {
        toast.error(res.error.message ?? "Неверный код. Попробуйте еще раз");
        return;
      }
      setOtp("");
      setStep("done");
      router.refresh();
    });
  }

  function handleDisable() {
    startTransition(async () => {
      const res = await authClient.twoFactor.disable({ password });
      if (res.error) {
        toast.error(res.error.message ?? "Неверный пароль");
        return;
      }
      toast.success("Двухфакторная аутентификация отключена");
      reset();
      router.refresh();
    });
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Резервные коды скопированы.");
  }

  function downloadBackupCodes() {
    const blob = new Blob(
      [
        `Harly two-factor backup codes\nEach code works once.\n\n${backupCodes.join("\n")}\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "harly-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="gap-5 p-6">
      <SectionHeader
        icon={DeviceMobileDuotoneIcon}
        title={"Двухфакторная аутентификация"}
        description={"Защитите свою учетную запись с помощью одноразового кода из приложения для аутентификации или электронной почты."}
        badge={
          <StatusPill tone={enabled ? "on" : "off"}>
            {enabled ? "Включено" : "Отключено"}
          </StatusPill>
        }
        action={
          step === "idle" ? (
            enabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("disable")}
              >
                {"Отключить 2FA "}</Button>
            ) : (
              <Button size="sm" onClick={() => setStep("password")}>
                {"Включить 2FA "}</Button>
            )
          ) : null
        }
      />

      <AnimatePresence mode="wait" initial={false}>
        {step === "password" && (
          <motion.div
            key="password"
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                {"Подтвердите свой пароль, чтобы сгенерировать QR-код аутентификатора. "}</p>
              <div className="space-y-2">
                <Label htmlFor="2fa-pw">{"Пароль"}</Label>
                <Input
                  id="2fa-pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && password && handleEnable()}
                  autoComplete="current-password"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleEnable}
                  disabled={!password || isPending}
                >
                  {isPending && <SpinnerIcon className="mr-1.5 size-3.5" />}
                  {"Продолжить "}</Button>
                <Button variant="ghost" size="sm" onClick={reset}>
                  {"Отмена "}</Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === "configure" && totpUri && (
          <motion.div
            key="configure"
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="space-y-5 rounded-xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                {"Отсканируйте этот QR-код с помощью приложения для аутентификации (Authy, Google Authenticator, 1Password…), затем введите 6-значный код для подтверждения настройки. "}</p>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* QR code */}
                <div className="flex justify-center sm:justify-start">
                  <div className="rounded-xl border bg-white p-3 shadow-sm">
                    <QRCodeSVG value={totpUri} size={168} />
                  </div>
                </div>

                {/* Backup codes */}
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {"Резервные коды "}</p>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-2.5 font-mono text-xs">
                    {backupCodes.map((c) => (
                      <span key={c} className="select-all text-foreground/80">
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={copyBackupCodes}
                    >
                      <CopyIcon className="mr-1 size-3" />
                      {"Копировать "}</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={downloadBackupCodes}
                    >
                      <DownloadDuotoneIcon className="mr-1 size-3" />
                      {"Скачать "}</Button>
                  </div>
                </div>
              </div>

              {/* OTP input */}
              <div className="space-y-2">
                <Label htmlFor="2fa-code">{"Введите код из приложения"}</Label>
                <div className="flex gap-2">
                  <Input
                    id="2fa-code"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" && otp.length === 6 && handleVerify()
                    }
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    className="w-36 font-mono tracking-widest"
                    autoComplete="one-time-code"
                  />
                  <Button
                    size="sm"
                    onClick={handleVerify}
                    disabled={otp.length !== 6 || isPending}
                  >
                    {isPending && <SpinnerIcon className="mr-1.5 size-3.5" />}
                    {"Проверить и включить "}</Button>
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={reset}>
                {"Отмена "}</Button>
            </div>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
            className="flex items-start gap-3 rounded-xl border border-pine/20 bg-sage/10 p-4"
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-pine/15">
              <CheckIcon className="size-3 text-pine" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">{"2FA теперь активна"}</p>
              <p className="text-sm text-muted-foreground">
                {"Храните резервные коды в надежном месте. Каждый из них сработает один раз, если вы потеряете доступ к своему аутентификатору. "}</p>
            </div>
          </motion.div>
        )}

        {step === "disable" && (
          <motion.div
            key="disable"
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm text-muted-foreground">
                {"Введите свой пароль, чтобы отключить двухфакторную аутентификацию. "}</p>
              <div className="space-y-2">
                <Label htmlFor="disable-pw">{"Пароль"}</Label>
                <Input
                  id="disable-pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && password && handleDisable()}
                  autoComplete="current-password"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisable}
                  disabled={!password || isPending}
                >
                  {isPending && <SpinnerIcon className="mr-1.5 size-3.5" />}
                  {"Отключить 2FA "}</Button>
                <Button variant="ghost" size="sm" onClick={reset}>
                  {"Отмена "}</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
