"use client";

import { localizeSystemText } from "@/lib/localize-system-text";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

import { TwoFactorCard } from "@/features/security/TwoFactorCard";
import { PasskeyQuickSetup } from "@/features/security/PasskeyQuickSetup";
import {
  completeRecruiterOnboardingAction,
  saveOnboardingAvatarAction,
  saveUserRoleAction,
} from "@/features/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/ui/FileDropzone";
import {
  SealCheckDuotoneIcon,
  ShieldCheckDuotoneIcon,
  UserPlusIcon,
} from "@/components/ui/icons/phosphor";
import {
  OnboardingShell,
  StepField,
  StepHeading,
  StepStagger,
  type OnboardingStepMeta,
} from "./OnboardingShell";

const STEPS: OnboardingStepMeta[] = [
  { key: "profile", label: "Ваш профиль", desc: "Как вас видят товарищи по команде", icon: UserPlusIcon },
  { key: "security", label: "Безопасность", desc: "Защитите свой аккаунт", icon: ShieldCheckDuotoneIcon },
];

export function RecruiterOnboarding({
  userName,
  workspaceName,
  require2fa,
  twoFactorEnabled,
  suggestedRole,
  initialAvatar,
}: {
  userName: string;
  workspaceName: string;
  require2fa: boolean;
  twoFactorEnabled: boolean;
  /** Role assigned at invite time (e.g. "Recruiter", "Hiring Manager"), used
   *  to pre-fill "Your role" below. Null for a custom role that has no name. */
  suggestedRole?: string | null;
  /** Existing profile photo (e.g. from an OAuth sign-in) to prefill. */
  initialAvatar?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [jobTitle, setJobTitle] = useState(suggestedRole ?? "");
  const [avatar, setAvatar] = useState(initialAvatar ?? "");

  const isLast = step === STEPS.length - 1;

  function next() {
    setError(null);
    if (step === 0) {
      startTransition(async () => {
        const trimmed = jobTitle.trim();
        if (trimmed) {
          const res = await saveUserRoleAction(trimmed);
          if (!res.ok) return setError(res.error ?? "Не удалось сохранить вашу роль.");
        }
        const avatarRes = await saveOnboardingAvatarAction(avatar || null);
        if (!avatarRes.ok) {
          return setError(avatarRes.error ?? "Не удалось сохранить фотографию.");
        }
        setStep(1);
      });
      return;
    }
    finish();
  }

  // Completion enforces the workspace 2FA policy server-side, so a stale client
  // cannot bypass it. If 2FA is required and not yet enabled, the action errors.
  function finish() {
    startTransition(async () => {
      const res = await completeRecruiterOnboardingAction();
      if (!res.ok) return setError(res.error ?? "Не удалось закончить.");
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border/70 bg-card p-8 text-center shadow-[0_18px_44px_-16px_rgba(31,41,38,0.16)] lg:p-10">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sage text-pine ring-1 ring-pine/10"
        >
          <SealCheckDuotoneIcon className="size-8" />
        </motion.span>
        <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-foreground">
          {"Ты в "}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {"Добро пожаловать в "}{workspaceName}. Воронка найма, кандидаты и задачи готовы к работе.
        </p>
        <Button
          className="mt-7 w-full"
          size="lg"
          onClick={() => { router.replace("/dashboard"); router.refresh(); }}
        >
          {"Перейти на панель управления "}</Button>
      </div>
    );
  }

  const canSkipSecurity = isLast && !require2fa && !twoFactorEnabled;
  // Mandatory 2FA not yet enabled: block navigation entirely rather than
  // let the user hit Back/Enter workspace and bounce off a server error.
  const blockedOnMandatory2fa = isLast && require2fa && !twoFactorEnabled;

  return (
    <OnboardingShell
      railTitle={"Добро пожаловать"}
      railFootnote="Less than a minute. You can update these in your account anytime."
      steps={STEPS}
      current={step}
      onJump={(i) => { if (i < step && !blockedOnMandatory2fa) { setStep(i); setError(null); } }}
      error={localizeSystemText(error)}
      pending={pending}
      isLast={isLast}
      onBack={() => { setStep((s) => s - 1); setError(null); }}
      onNext={next}
      onSkip={canSkipSecurity ? finish : undefined}
      nextLabel={isLast ? "Войти в рабочую область" : "Продолжить"}
      minHeight="min-h-[30rem]"
      navHint={
        blockedOnMandatory2fa
          ? "Завершите настройку двухфакторной аутентификации выше, чтобы продолжить."
          : undefined
      }
    >
      {step === 0 && (
        <StepStagger>
          <StepField>
            <StepHeading
              eyebrow={`Здравствуйте, ${userName}`}
              title={`Добро пожаловать в ${workspaceName}`}
              subtitle={"Пара быстрых действий, и вы нанимаете. Во-первых, как товарищи по команде должны вас знать?"}
            />
          </StepField>
          <StepField className="mt-7 flex items-center gap-5">
            <FileDropzone
              value={avatar || null}
              onChange={(url) => { setAvatar(url ?? ""); setError(null); }}
              variant="avatar"
              hint={"Фотография профиля · PNG, JPG или WEBP"}
            />
            <div className="flex-1 space-y-1">
              <Label>{"Фото профиля"}</Label>
              <p className="text-xs text-muted-foreground">
                {"Отображается в вашем профиле и рядом с вашими действиями. Необязательный. "}</p>
            </div>
          </StepField>
          <StepField className="mt-6 max-w-md space-y-2">
            <Label htmlFor="rec-role">{"Ваша роль"}</Label>
            <Input
              id="rec-role"
              autoFocus
              value={jobTitle}
              onChange={(e) => { setJobTitle(e.target.value); setError(null); }}
              placeholder={"Технический рекрутер"}
              maxLength={80}
              onKeyDown={(e) => { if (e.key === "Enter") next(); }}
            />
            <p className="text-xs text-muted-foreground">{"Отображается в вашем профиле и команде по найму. Необязательный."}</p>
          </StepField>
        </StepStagger>
      )}

      {step === 1 && (
        <StepStagger>
          <StepField>
            <StepHeading
              title={"Защитите свой аккаунт"}
              subtitle={
                require2fa
                  ? "Для этой рабочей области требуется двухфакторная аутентификация. Настройте его на завершение."
                  : "Добавьте двухфакторную аутентификацию для дополнительного уровня защиты. Необязательный."
              }
            />
          </StepField>
          <StepField className="mt-6">
            {twoFactorEnabled ? (
              <div className="flex items-center gap-3 rounded-xl border border-pine/20 bg-sage/30 px-4 py-3.5">
                <ShieldCheckDuotoneIcon className="size-5 text-pine" />
                <p className="text-sm font-medium text-foreground">{"Двухфакторная аутентификация активна."}</p>
              </div>
            ) : (
              <TwoFactorCard enabled={false} />
            )}
          </StepField>
          {!twoFactorEnabled ? (
            <StepField className="mt-4">
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {"или "}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="mt-4">
                <PasskeyQuickSetup />
              </div>
            </StepField>
          ) : null}
        </StepStagger>
      )}
    </OnboardingShell>
  );
}
