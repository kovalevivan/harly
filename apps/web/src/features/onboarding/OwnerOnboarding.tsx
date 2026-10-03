"use client";

import { localizeSystemText } from "@/lib/localize-system-text";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { motion } from "motion/react";

import { authClient } from "@harly/auth/client";
import { InviteTeammatesSheet } from "@/features/workspaces/InviteTeammatesSheet";
import type { AssignableRole } from "@/features/workspaces/InviteTeammatesSheet";
import {
  completeOnboardingAction,
  saveOnboardingAboutAction,
  saveOnboardingAvatarAction,
  saveOnboardingBrandingAction,
  setRequire2faAction,
} from "@/features/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileDropzone } from "@/components/ui/FileDropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BuildingsIcon } from "@/components/ui/icons/settings";
import {
  CaretRightIcon,
  CheckIcon,
  DownloadDuotoneIcon,
  MagicWandDuotoneIcon,
  MegaphoneDuotoneIcon,
  PaletteDuotoneIcon,
  PlugsConnectedIcon,
  RobotDuotoneIcon,
  SealCheckDuotoneIcon,
  ShieldCheckDuotoneIcon,
  UserPlusIcon,
  UsersThreeDuotoneIcon,
} from "@/components/ui/icons/phosphor";
import { cn, slugify } from "@/lib/utils";
import {
  OnboardingShell,
  StepField,
  StepHeading,
  StepStagger,
  type OnboardingStepMeta,
} from "./OnboardingShell";

const PINE = "#3f6212";

const STEPS: OnboardingStepMeta[] = [
  { key: "workspace", label: "Компания", desc: "Назовите свое рабочее место для найма", icon: BuildingsIcon },
  { key: "branding", label: "Брендинг", desc: "Логотип, цвет и слоган", icon: MagicWandDuotoneIcon },
  { key: "about", label: "О тебе", desc: "Ваша роль и как вы нас нашли", icon: MegaphoneDuotoneIcon },
  { key: "security", label: "Безопасность", desc: "Защитите данные своей команды", icon: ShieldCheckDuotoneIcon },
  { key: "team", label: "Пригласить команду", desc: "Привлекайте товарищей по команде", icon: UsersThreeDuotoneIcon },
];

const ACQUISITION = [
  "Поисковая система",
  "Социальные сети",
  "Друг или коллега",
  "GitHub/Открытый исходный код",
  "Блог или статья",
  "Другое",
] as const;

// Structured self-described role, persisted to user.onboardingRole (enum).
const SELF_ROLES = [
  { value: "founder", label: "Основатель/генеральный директор" },
  { value: "recruiter", label: "Рекрутер" },
  { value: "hr_manager", label: "Менеджер по персоналу/HR" },
  { value: "hiring_manager", label: "Менеджер по найму" },
  { value: "other", label: "Что-то еще" },
] as const;

const INVITE_ROLES = [
  { value: "recruiter", label: "Рекрутер" },
  { value: "hiring_manager", label: "Менеджер по найму" },
  { value: "admin", label: "Админ" },
] as const;

// Balanced accent palette with evergreen, cool, warm and neutral options.
const SWATCHES = [
  "#3f6212",
  "#0f766e",
  "#166534",
  "#2563eb",
  "#4f46e5",
  "#7c3aed",
  "#be123c",
  "#c2410c",
  "#a16207",
  "#1f2937",
];

const INVITE_ROLE_OPTIONS: AssignableRole[] = INVITE_ROLES.map((role) => ({
  key: role.value,
  name: role.label,
}));

export function OwnerOnboarding({
  userName,
  initialOrg,
}: {
  userName: string;
  /** Set when resuming setup for an owner whose workspace already exists. */
  initialOrg?: {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    tagline?: string | null;
    primaryColor?: string | null;
  };
}) {
  const router = useRouter();
  // Resuming an existing workspace? Skip the create step.
  const [step, setStep] = useState(initialOrg ? 1 : 0);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1, company
  const [name, setName] = useState(initialOrg?.name ?? "");
  const [orgId, setOrgId] = useState<string | null>(initialOrg?.id ?? null);

  // Step 2, branding
  const [logoUrl, setLogoUrl] = useState(initialOrg?.logo ?? "");
  const [tagline, setTagline] = useState(initialOrg?.tagline ?? "");
  const [color, setColor] = useState(initialOrg?.primaryColor ?? PINE);

  // Step 3, about
  const [selfRole, setSelfRole] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [jobTitle, setJobTitle] = useState("");
  const [avatar, setAvatar] = useState("");

  // Step 4, security
  const [require2fa, setRequire2fa] = useState(false);

  // Step 5, invites
  const isLast = step === STEPS.length - 1;

  function goNext() {
    setError(null);
    if (step === 0) return createWorkspace();
    if (isLast) return finish();
    void persistCurrent();
    setStep((s) => s + 1);
  }

  // Create the org as soon as the name is set, so later steps persist against
  // it (and an abandoned setup is resumable because the owner already exists).
  // The slug is derived silently from the company name. Harly is single-tenant,
  // so there is no public /board/<slug> to choose. The board lives at the root.
  function createWorkspace() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Введите название вашей компании.");
    const slug = slugify(trimmed);
    if (!slug) return setError("В названии компании должна быть хотя бы одна буква или цифра.");
    startTransition(async () => {
      if (!orgId) {
        const response = await fetch("/api/setup/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, slug }),
        });
        const created = (await response.json()) as { id?: string; error?: string };
        if (!response.ok || !created.id) {
          return setError(created.error ?? "Не удалось создать рабочую область.");
        }
        setOrgId(created.id);
        await authClient.organization.setActive({ organizationId: created.id });
      }
      setStep(1);
    });
  }

  // Persist the current step's data. Awaited where the user is leaving the step
  // via Continue; surfaces the error instead of silently dropping data.
  async function persistCurrent(): Promise<boolean> {
    if (step === 1) {
      const res = await saveOnboardingBrandingAction({ logoUrl, tagline, primaryColor: color });
      if (!res.ok) { setError(res.error ?? "Не удалось сохранить брендинг."); return false; }
    }
    if (step === 2) {
      const res = await saveOnboardingAboutAction({
        role: selfRole || undefined,
        jobTitle: jobTitle.trim() || undefined,
        source: source || undefined,
      });
      if (!res.ok) { setError(res.error ?? "Не удалось сохранить ваши данные."); return false; }
      const avatarRes = await saveOnboardingAvatarAction(avatar || null);
      if (!avatarRes.ok) { setError(avatarRes.error ?? "Не удалось сохранить фотографию."); return false; }
    }
    if (step === 3) {
      const res = await setRequire2faAction(require2fa);
      if (!res.ok) { setError(res.error ?? "Не удалось сохранить настройки безопасности."); return false; }
    }
    return true;
  }

  function skip() {
    setError(null);
    startTransition(async () => {
      if (await persistCurrent()) setStep((s) => s + 1);
    });
  }

  function next() {
    if (step === 0 || isLast) return goNext();
    setError(null);
    startTransition(async () => {
      if (await persistCurrent()) setStep((s) => s + 1);
    });
  }

  function finish() {
    startTransition(async () => {
      // Security already persisted on navigation; persist again defensively,
      // then mark onboarding complete.
      const sec = await setRequire2faAction(require2fa);
      if (!sec.ok) return setError(sec.error ?? "Не удалось сохранить настройки безопасности.");

      const res = await completeOnboardingAction();
      if (!res.ok) return setError(res.error ?? "Не удалось завершить настройку.");
      setDone(true);
    });
  }

  if (done) {
    return (
      <Launchpad
        workspaceName={name}
        require2fa={require2fa}
        onEnter={() => { router.replace("/dashboard"); router.refresh(); }}
      />
    );
  }

  return (
    <OnboardingShell
      railTitle={"Настроить"}
      railFootnote="Takes about 2 minutes. You can change everything later in Settings."
      steps={STEPS}
      current={step}
      onJump={(i) => { if (i < step) { setStep(i); setError(null); } }}
      error={localizeSystemText(error)}
      pending={pending}
      isLast={isLast}
      onBack={() => { setStep((s) => s - 1); setError(null); }}
      onNext={next}
      onSkip={step >= 1 && step < STEPS.length - 1 ? skip : undefined}
      nextLabel={isLast ? "Завершить настройку" : "Продолжить"}
    >
      {step === 0 && (
        <StepCompany userName={userName} name={name} onName={setName} locked={Boolean(orgId)} />
      )}
      {step === 1 && (
        <StepBranding
          logoUrl={logoUrl}
          onLogo={setLogoUrl}
          tagline={tagline}
          onTagline={setTagline}
          color={color}
          onColor={setColor}
        />
      )}
      {step === 2 && (
        <StepAbout
          selfRole={selfRole}
          onSelfRole={setSelfRole}
          source={source}
          onSource={setSource}
          jobTitle={jobTitle}
          onJobTitle={setJobTitle}
          avatar={avatar}
          onAvatar={setAvatar}
        />
      )}
      {step === 3 && <StepSecurity require2fa={require2fa} onToggle={setRequire2fa} />}
      {step === 4 && (
        <StepInvite assignableRoles={INVITE_ROLE_OPTIONS} />
      )}
    </OnboardingShell>
  );
}

function StepCompany({ userName, name, onName, locked }: { userName: string; name: string; onName: (v: string) => void; locked: boolean }) {
  return (
    <StepStagger>
      <StepField>
        <StepHeading
          eyebrow={`Добро пожаловать, ${userName}`}
          title={"Как называется ваша компания?"}
          subtitle={"Это имя кандидаты видят на вашей странице вакансий и в электронных письмах с заявками."}
        />
      </StepField>
      <StepField className="mt-7 space-y-3">
        <Input
          autoFocus
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={"Акме Рекрутинг"}
          className="h-11"
          disabled={locked}
        />
      </StepField>
    </StepStagger>
  );
}

function StepBranding({ logoUrl, onLogo, tagline, onTagline, color, onColor }: { logoUrl: string; onLogo: (v: string) => void; tagline: string; onTagline: (v: string) => void; color: string; onColor: (v: string) => void }) {
  const isCustomColor = !SWATCHES.some((swatch) => swatch.toLowerCase() === color.toLowerCase());

  return (
    <StepStagger>
      <StepField>
        <StepHeading
          title={"Сделайте это своим"}
          subtitle={"Добавьте свой логотип, слоган и цвет акцента. Все является необязательным и редактируемым позже."}
        />
      </StepField>
      <StepField className="mt-7 flex items-center gap-5">
        <FileDropzone
          value={logoUrl || null}
          onChange={(url) => onLogo(url ?? "")}
          variant="avatar"
          hint={"Квадратный логотип · PNG, JPG, SVG или WEBP"}
        />
        <div className="flex-1 space-y-1">
          <Label>{"Логотип компании"}</Label>
          <p className="text-xs text-muted-foreground">
            {"Отображается как значок вашего приложения и на странице вакансий. Квадрат работает лучше всего. "}</p>
        </div>
      </StepField>
      <StepField className="mt-6 space-y-2">
        <Label htmlFor="ob-tagline">{"Слоган страницы «Карьера»"}</Label>
        <Input
          id="ob-tagline"
          value={tagline}
          onChange={(e) => onTagline(e.target.value)}
          placeholder={"Короткая строка о вашей компании"}
          maxLength={120}
        />
      </StepField>
      <StepField className="mt-6 space-y-2">
        <Label>{"Акцентный цвет"}</Label>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onColor(s)}
              aria-label={`Используйте ${s}`}
              className={cn(
                "size-8 rounded-full ring-2 ring-offset-2 ring-offset-card transition active:scale-95 motion-reduce:active:scale-100",
                color.toLowerCase() === s.toLowerCase() ? "ring-pine" : "ring-transparent",
              )}
              style={{ backgroundColor: s }}
              aria-pressed={color.toLowerCase() === s.toLowerCase()}
            />
          ))}
          <label
            className={cn(
              "relative flex h-8 shrink-0 cursor-pointer items-center gap-2 overflow-hidden rounded-full border bg-card px-2.5 text-xs font-medium text-foreground transition hover:border-ring/40 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30",
              isCustomColor && "border-ring ring-2 ring-ring/20",
            )}
            aria-label={"Пользовательский цвет"}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => onColor(e.target.value)}
              className="absolute inset-0 z-10 cursor-pointer opacity-0"
            />
            <span
              className="pointer-events-none size-4 rounded-full border border-black/10"
              style={{ backgroundColor: color }}
            />
            <PaletteDuotoneIcon className="pointer-events-none size-3.5 text-muted-foreground" />
            <span className="pointer-events-none">{"Пользовательский"}</span>
          </label>
        </div>
      </StepField>
    </StepStagger>
  );
}

function StepAbout({ selfRole, onSelfRole, source, onSource, jobTitle, onJobTitle, avatar, onAvatar }: { selfRole: string; onSelfRole: (v: string) => void; source: string; onSource: (v: string) => void; jobTitle: string; onJobTitle: (v: string) => void; avatar: string; onAvatar: (v: string) => void }) {
  return (
    <StepStagger>
      <StepField>
        <StepHeading
          title={"Расскажи нам о себе"}
          subtitle={"Помогает нам адаптировать Харли. Необязательный. Пропустите все, чем не хотите делиться."}
        />
      </StepField>
      <StepField className="mt-7 flex items-center gap-5">
        <FileDropzone
          value={avatar || null}
          onChange={(url) => onAvatar(url ?? "")}
          variant="avatar"
          hint={"Фотография профиля · PNG, JPG или WEBP"}
        />
        <div className="flex-1 space-y-1">
          <Label>{"Фото профиля"}</Label>
          <p className="text-xs text-muted-foreground">
            {"Отображается в вашем профиле и рядом с вашими действиями. "}</p>
        </div>
      </StepField>
      <StepField className="mt-6 space-y-2">
        <Label>{"Что лучше всего описывает вас?"}</Label>
        <Select value={selfRole} onValueChange={onSelfRole}>
          <SelectTrigger className="w-full"><SelectValue placeholder={"Выберите один"} /></SelectTrigger>
          <SelectContent>
            {SELF_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </StepField>
      <StepField className="mt-5 space-y-2">
        <Label htmlFor="ob-title">{"Ваша должность"}</Label>
        <Input
          id="ob-title"
          value={jobTitle}
          onChange={(e) => onJobTitle(e.target.value)}
          placeholder={"Руководитель отдела талантов"}
          maxLength={80}
        />
        <p className="text-xs text-muted-foreground">{"Отображается в вашем профиле и команде по найму."}</p>
      </StepField>
      <StepField className="mt-5 space-y-2">
        <Label>{"Как вы узнали о нас?"}</Label>
        <Select value={source} onValueChange={onSource}>
          <SelectTrigger className="w-full"><SelectValue placeholder={"Выберите один"} /></SelectTrigger>
          <SelectContent>
            {ACQUISITION.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </StepField>
    </StepStagger>
  );
}

function StepSecurity({ require2fa, onToggle }: { require2fa: boolean; onToggle: (v: boolean) => void }) {
  return (
    <StepStagger>
      <StepField>
        <StepHeading
          title={"Защитите свое рабочее пространство"}
          subtitle={"Рекомендуется для команд, работающих с данными кандидатов."}
        />
      </StepField>
      <StepField>
        <label className="mt-7 flex items-start justify-between gap-4 rounded-xl border bg-card px-4 py-3.5">
          <span className="flex items-start gap-3">
            <ShieldCheckDuotoneIcon className="mt-0.5 size-5 text-pine" />
            <span>
              <span className="block text-sm font-medium text-foreground">{"Требовать 2FA для всех участников"}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{"Перед доступом к панели управления каждый должен настроить двухфакторную аутентификацию. Вы можете включить свой собственный 2FA из своей учетной записи."}</span>
            </span>
          </span>
          <Switch checked={require2fa} onCheckedChange={onToggle} aria-label={"Требовать 2FA"} />
        </label>
      </StepField>
    </StepStagger>
  );
}

function StepInvite({ assignableRoles }: { assignableRoles: AssignableRole[] }) {
  return (
    <StepStagger>
      <StepField>
        <StepHeading
          title={"Пригласите свою команду"}
          subtitle={"Пригласите одного человека или целую команду. Вы также можете сделать это позже в настройках."}
        />
      </StepField>
      <StepField className="mt-7 space-y-3">
        <InviteTeammatesSheet
          assignableRoles={assignableRoles}
          refreshOnSuccess={false}
          trigger={
            <Button type="button" variant="secondary">
              <UserPlusIcon className="size-4" />
              {"Пригласить товарищей по команде "}</Button>
          }
        />
        <p className="text-xs text-muted-foreground">
          {"Добавляйте электронные письма одно за другим, вставляйте список или импортируйте файл CSV. "}</p>
      </StepField>
    </StepStagger>
  );
}

// ─── Launchpad (all set) ──────────────────────────────────────────────────────

function Launchpad({ workspaceName, require2fa, onEnter }: { workspaceName: string; require2fa: boolean; onEnter: () => void }) {
  const nextSteps = useMemo(
    () => [
      { icon: RobotDuotoneIcon, label: "Подключите поставщика ИИ", hint: "Автоматическая проверка и черновик", href: "/settings/ai" as Route },
      { icon: PlugsConnectedIcon, label: "Подключите интеграции", hint: "Cal.com, Slack, Discord", href: "/settings/integrations" as Route },
      { icon: DownloadDuotoneIcon, label: "Импортировать кандидатов", hint: "Из CSV или Greenhouse", href: "/dashboard/candidates" as Route },
    ],
    [],
  );
  const done = [
    "Рабочая область создана",
    "Брендированная страница вакансий",
    require2fa ? "2FA обязателен для всех" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border/70 bg-card p-8 text-center shadow-[0_12px_32px_-12px_rgba(31,41,38,0.12)] lg:p-10">
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sage text-pine ring-1 ring-pine/10"
      >
        <SealCheckDuotoneIcon className="size-8" />
      </motion.span>
      <h2 className="mt-5 font-display text-2xl tracking-tight text-foreground">
        {workspaceName || "Ваше рабочее пространство"} {"готов "}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {"Все готово, чтобы начать нанимать сотрудников. Вот что вы сделали и несколько вещей, которые стоит сделать дальше. "}</p>

      <div className="mt-7 space-y-2 text-left">
        {done.map((d) => (
          <div key={d} className="flex items-center gap-2.5 rounded-xl border border-pine/15 bg-sage/30 px-4 py-2.5">
            <CheckIcon className="size-4 text-pine" />
            <span className="text-sm font-medium text-foreground">{d}</span>
          </div>
        ))}
        {nextSteps.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href} className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5 transition-colors hover:border-pine/30 hover:bg-muted/40">
              <Icon className="size-5 text-muted-foreground" />
              <span className="flex-1">
                <span className="block text-sm font-medium text-foreground">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.hint}</span>
              </span>
              <CaretRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>

      <Button className="mt-7 w-full" size="lg" onClick={onEnter}>
        {"Перейти на панель управления "}</Button>
    </div>
  );
}
