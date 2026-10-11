"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Hash,
  Languages,
  LogOut,
  LockKeyhole,
  MapPin,
  Mail,
  PencilLine,
  Phone,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { authClient, signOut } from "@/lib/auth-client";
import { getImageFileValidationError } from "@/lib/storage-validation";
import {
  changeUsernameAction,
  checkUsernameAvailableAction,
  updateOwnProfileAction,
} from "@/features/people/actions";
import type { WeeklyAvailability } from "@harly/db";
import { AvatarCropDialog } from "@/components/ui/AvatarCropDialog";
import { GithubIcon } from "@/components/ui/icons/GithubIcon";
import { LinkedinLogo } from "@/components/ui/icons/brands";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { DemoLockedNotice } from "@/features/demo/DemoLockedNotice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { revokeMySessionAction, revokeOtherMySessionsAction, type SessionDevice } from "@/features/security/session-actions";

const WEEKDAYS: (keyof WeeklyAvailability)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const DAY_LABELS: Record<keyof WeeklyAvailability, string> = {
  monday: "Пн.",
  tuesday: "Вт",
  wednesday: "ср.",
  thursday: "Чт",
  friday: "Пт",
  saturday: "Суббота",
  sunday: "Солнце",
};

function emptyWeek(): WeeklyAvailability {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

/** "09:00-17:00, 18:00-19:00" -> TimeRange[]; throws on malformed input. */
function parseDayRanges(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed.split(",").map((chunk) => {
    const [start, end] = chunk
      .trim()
      .split("-")
      .map((s) => s.trim());
    if (
      !/^\d{2}:\d{2}$/.test(start ?? "") ||
      !/^\d{2}:\d{2}$/.test(end ?? "")
    ) {
      throw new Error(`Invalid range "${chunk.trim()}". Use HH:mm-HH:mm.`);
    }
    return { start, end };
  });
}

function formatDayRanges(ranges: { start: string; end: string }[]) {
  return ranges.map((r) => `${r.start}-${r.end}`).join(", ");
}

type AccountUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  jobTitle: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  username: string | null;
  timezone: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  weeklyAvailability: WeeklyAvailability | null;
  capacityHoursPerWeek: number | null;
  createdAt?: Date;
};

function formatDate(date: Date | undefined) {
  if (!date) return "Не установлено";
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const compact = !description;

  return (
    <Card className={cn("gap-0 py-0 overflow-hidden", className)}>
      <CardHeader
        className={cn(
          "border-b bg-muted/20 px-6",
          compact ? "flex items-center justify-between py-3.5" : "pt-4 !pb-3.5",
        )}
      >
        <div className={cn(compact ? "flex items-center" : "space-y-1.5")}>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("px-6", compact ? "py-3" : "py-5")}>
        {children}
      </CardContent>
    </Card>
  );
}

function IconInput({
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
        <Icon className="size-4" />
      </span>
      <Input className={cn("pl-10", className)} {...props} />
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  icon: Icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
          <Icon className="size-4" />
        </span>
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-10 pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function SocialLinkField({
  icon: Icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">
          <Icon className="size-4" />
        </span>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10 text-sm"
        />
      </div>
    </div>
  );
}

function splitPersonName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

async function uploadImage(file: File | Blob): Promise<string> {
  const filename = file instanceof File ? file.name : "avatar.jpg";
  const presign = await fetch("/api/storage/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "image",
      filename,
      contentType: file.type || "image/jpeg",
      contentLength: file.size,
    }),
  });

  if (!presign.ok) throw new Error("Could not prepare the upload.");

  const data = (await presign.json()) as {
    uploadUrl: string;
    fileUrl: string;
    key: string;
  };

  const put = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });

  if (!put.ok) throw new Error("Upload failed. Try again.");
  return data.fileUrl;
}

export function AccountSettingsPanel({
  user,
  securitySlot,
  sessions,
  demoLocked = false,
}: {
  user: AccountUser;
  securitySlot?: React.ReactNode;
  sessions: SessionDevice[];
  demoLocked?: boolean;
}) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const initialName = splitPersonName(user.name);
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [image, setImage] = useState(user.image ?? "");
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [location, setLocation] = useState(user.location ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(user.linkedinUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(user.githubUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(user.websiteUrl ?? "");
  const [timezone, setTimezone] = useState(user.timezone ?? "");
  const [specialtiesText, setSpecialtiesText] = useState(
    (user.specialties ?? []).join(", "),
  );
  const [languagesText, setLanguagesText] = useState(
    (user.languages ?? []).join(", "),
  );
  const [capacity, setCapacity] = useState(
    user.capacityHoursPerWeek != null ? String(user.capacityHoursPerWeek) : "",
  );
  const [availabilityText, setAvailabilityText] = useState<
    Record<keyof WeeklyAvailability, string>
  >(() => {
    const week = user.weeklyAvailability ?? emptyWeek();
    return Object.fromEntries(
      WEEKDAYS.map((day) => [day, formatDayRanges(week[day] ?? [])]),
    ) as Record<keyof WeeklyAvailability, string>;
  });
  const [savingProfile, startProfile] = useTransition();
  const [profileDirty, setProfileDirty] = useState(false);

  const [username, setUsername] = useState(user.username ?? "");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, startUsername] = useTransition();

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, startEmail] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, startPassword] = useTransition();

  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSavePassword =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  const [signingOut, startSignOut] = useTransition();

  const fullName = [firstName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(" ");
  const displayName = fullName || user.name;

  function markDirty() {
    if (!profileDirty) setProfileDirty(true);
  }

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed || trimmed === (user.username ?? "")) return;

    const handle = setTimeout(() => {
      setUsernameStatus("checking");
      checkUsernameAvailableAction(trimmed).then((result) => {
        if (result.available) {
          setUsernameStatus("available");
          setUsernameError(null);
        } else {
          setUsernameStatus(
            result.error === "Username is already taken." ? "taken" : "invalid",
          );
          setUsernameError(result.error ?? null);
        }
      });
    }, 400);

    return () => clearTimeout(handle);
  }, [username, user.username]);

  function saveUsername() {
    startUsername(async () => {
      const result = await changeUsernameAction(username.trim());
      if (!result.success) {
        toast.error(result.error ?? "Не удалось обновить имя пользователя.");
        return;
      }
      toast.success("Имя пользователя обновлено.");
      setUsernameStatus("idle");
      router.refresh();
    });
  }

  function buildProfilePayload() {
    let weeklyAvailability: WeeklyAvailability;
    try {
      weeklyAvailability = Object.fromEntries(
        WEEKDAYS.map((day) => [day, parseDayRanges(availabilityText[day])]),
      ) as WeeklyAvailability;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Неверное наличие.",
      );
      throw error;
    }

    return {
      name: displayName,
      image: image.trim() || null,
      jobTitle: jobTitle.trim() || null,
      phone: phone.trim() || null,
      location: location.trim() || null,
      bio: bio.trim() || null,
      linkedinUrl: linkedinUrl.trim() || null,
      githubUrl: githubUrl.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      timezone: timezone.trim() || null,
      specialties: specialtiesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      languages: languagesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      weeklyAvailability,
      capacityHoursPerWeek: capacity.trim() ? Number(capacity.trim()) : null,
    };
  }

  function saveProfile() {
    startProfile(async () => {
      let payload: ReturnType<typeof buildProfilePayload>;
      try {
        payload = buildProfilePayload();
      } catch {
        return;
      }

      const result = await updateOwnProfileAction(payload);

      if (!result.success) {
        toast.error("Не удалось обновить профиль.");
        return;
      }

      await authClient.updateUser({
        name: displayName,
        image: image.trim() || undefined,
      });

      toast.success("Профиль обновлен.");
      setProfileDirty(false);
      router.refresh();
    });
  }

  function handleAvatarFileSelect(file: File | null) {
    if (!file) return;
    const error = getImageFileValidationError(file);
    if (error) {
      toast.error(error);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    setCropOpen(true);
  }

  function handleCropComplete(blob: Blob) {
    setCropOpen(false);
    startProfile(async () => {
      try {
        const url = await uploadImage(blob);
        setImage(url);
        let payload: ReturnType<typeof buildProfilePayload>;
        try {
          payload = { ...buildProfilePayload(), image: url };
        } catch {
          return;
        }
        const result = await updateOwnProfileAction(payload);

        if (!result.success) {
          toast.error("Не удалось обновить аватар.");
          return;
        }

        await authClient.updateUser({
          name: displayName,
          image: url,
        });

        toast.success("Аватар обновлен.");
        router.refresh();
      } catch {
        toast.error("Загрузка не удалась.");
      } finally {
        if (cropSrc) URL.revokeObjectURL(cropSrc);
        setCropSrc(null);
      }
    });
  }

  function removeAvatar() {
    setImage("");
    startProfile(async () => {
      let payload: ReturnType<typeof buildProfilePayload>;
      try {
        payload = { ...buildProfilePayload(), image: null };
      } catch {
        return;
      }
      const result = await updateOwnProfileAction(payload);

      if (!result.success) {
        toast.error("Не удалось удалить аватар.");
        return;
      }

      await authClient.updateUser({ name: displayName, image: undefined });
      toast.success("Аватар удален.");
      router.refresh();
    });
  }

  function saveEmail() {
    const email = newEmail.trim();
    if (!email) return;
    startEmail(async () => {
      const result = await authClient.changeEmail({ newEmail: email });
      if (result.error) {
        toast.error(result.error.message ?? "Не удалось изменить адрес электронной почты.");
      } else {
        toast.success("Электронная почта обновлена.");
        setNewEmail("");
        router.refresh();
      }
    });
  }

  function savePassword() {
    if (!canSavePassword) {
      toast.error(
        "Введите свой текущий пароль и соответствующий новый (8+ символов).",
      );
      return;
    }
    startPassword(async () => {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Не удалось изменить пароль.");
      } else {
        toast.success("Пароль изменен.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  }

  function handleSignOut() {
    startSignOut(async () => {
      await signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  function revokeSession(sessionId: string) {
    startSignOut(async () => {
      const result = await revokeMySessionAction(sessionId);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось отменить сеанс.");
        return;
      }
      if (result.current) {
        await signOut();
        router.replace("/login");
        router.refresh();
      } else {
        toast.success("Сессия отменена.");
        router.refresh();
      }
    });
  }

  async function copyUserId() {
    try {
      await navigator.clipboard.writeText(user.id);
      toast.success("Идентификатор аккаунта скопирован.");
    } catch {
      // silent
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {demoLocked ? (
        <DemoLockedNotice>
          {"Изменения личности учетной записи заблокированы в демо-версии, поэтому общий логин остается доступным для всех. "}</DemoLockedNotice>
      ) : null}
      {/* ─── Profile header ─── */}
      <div className="flex flex-col items-center gap-4 pt-2 sm:flex-row sm:items-center sm:gap-6">
        <div className="group relative shrink-0">
          <UserAvatar
            name={displayName}
            src={image || null}
            size="xl"
            className="ring-2 ring-border/50 ring-offset-2 ring-offset-background"
          />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={demoLocked || savingProfile}
            aria-label={"Сменить аватар"}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white/0 transition-all duration-150 ease-out hover:bg-black/40 hover:text-white/90 focus-visible:bg-black/40 focus-visible:text-white/90 focus-visible:outline-none active:scale-[0.97]"
          >
            <Camera className="size-5" strokeWidth={1.8} />
          </button>
          {image && (
            <button
              type="button"
              onClick={removeAvatar}
              aria-label={"Удалить аватар"}
              className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <span className="text-xs leading-none">×</span>
            </button>
          )}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="sr-only"
            onChange={(e) => {
              handleAvatarFileSelect(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {displayName}
            </h2>
            {user.jobTitle ? (
              <Badge variant="secondary" className="w-fit shrink-0">
                {user.jobTitle}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-start">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {"Участник с "}{formatDate(user.createdAt)}
            </span>
            <button
              type="button"
              onClick={copyUserId}
              className="group flex items-center gap-1.5 transition hover:text-foreground"
            >
              <Hash className="size-3.5" />
              <span>{user.id.slice(0, 12)}…</span>
              <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{"Профиль"}</TabsTrigger>
          <TabsTrigger value="security">{"Безопасность"}</TabsTrigger>
          <TabsTrigger value="session">{"Сессия"}</TabsTrigger>
        </TabsList>

        {/* ─── PROFILE TAB ─── */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          <SectionCard
            title={"Личная информация"}
            description={"Ваше имя и то, как другие видят вас на платформе."}
          >
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="acc-first-name">{"Имя"}</Label>
                  <Input
                    id="acc-first-name"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      markDirty();
                    }}
                    placeholder={"Ада"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acc-last-name">{"Фамилия"}</Label>
                  <Input
                    id="acc-last-name"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      markDirty();
                    }}
                    placeholder={"ловелас"}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="acc-job-title">{"Должность"}</Label>
                  <IconInput
                    icon={UserRound}
                    id="acc-job-title"
                    value={jobTitle}
                    onChange={(e) => {
                      setJobTitle(e.target.value);
                      markDirty();
                    }}
                    placeholder={"например Инженерный менеджер"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acc-phone">{"Телефон"}</Label>
                  <IconInput
                    icon={Phone}
                    id="acc-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      markDirty();
                    }}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="acc-location">{"Расположение"}</Label>
                  <IconInput
                    icon={MapPin}
                    id="acc-location"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      markDirty();
                    }}
                    placeholder={"Сан-Франциско, Калифорния"}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={"Био"}
            description={"Краткое описание, отображаемое в вашем профиле и в представлениях команды по найму."}
          >
            <Textarea
              id="acc-bio"
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                markDirty();
              }}
              placeholder={"Расскажите своей команде немного о себе…"}
              className="min-h-[100px] resize-y"
            />
          </SectionCard>

          <SectionCard
            title={"Ссылки"}
            description={"Связанные профили и личные ссылки."}
          >
            <div className="space-y-4">
              <SocialLinkField
                icon={LinkedinLogo}
                label="LinkedIn"
                placeholder="https://linkedin.com/in/username"
                value={linkedinUrl}
                onChange={(v) => {
                  setLinkedinUrl(v);
                  markDirty();
                }}
              />
              <SocialLinkField
                icon={GithubIcon}
                label="GitHub"
                placeholder="https://github.com/username"
                value={githubUrl}
                onChange={(v) => {
                  setGithubUrl(v);
                  markDirty();
                }}
              />
              <SocialLinkField
                icon={Globe}
                label={"Веб-сайт"}
                placeholder="https://yoursite.com"
                value={websiteUrl}
                onChange={(v) => {
                  setWebsiteUrl(v);
                  markDirty();
                }}
              />
            </div>
          </SectionCard>

          <SectionCard
            title={"Имя пользователя"}
            description={"URL вашего внутреннего профиля. При его изменении старая ссылка будет работать через перенаправление."}
            action={
              <Button
                variant="outline"
                onClick={saveUsername}
                disabled={
                  savingUsername ||
                  usernameStatus !== "available" ||
                  username.trim() === (user.username ?? "")
                }
              >
                {savingUsername ? "Сохранение…" : "Сохранить имя пользователя"}
              </Button>
            }
          >
            <div className="space-y-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                  @
                </span>
                <Input
                  id="acc-username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase());
                    setUsernameStatus("idle");
                    setUsernameError(null);
                  }}
                  placeholder="ada-lovelace"
                  className="pl-7 pr-9"
                  aria-describedby="acc-username-hint"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === "available" && (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  )}
                  {(usernameStatus === "taken" ||
                    usernameStatus === "invalid") && (
                    <XCircle className="size-4 text-destructive" />
                  )}
                </span>
              </div>
              <p
                id="acc-username-hint"
                className={cn(
                  "text-xs",
                  usernameStatus === "taken" || usernameStatus === "invalid"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {usernameError ??
                  (user.username
                    ? `Ваш профиль: /люди/${user.username}`
                    : "Выберите имя пользователя, чтобы получить общедоступный внутренний профиль.")}
              </p>
              {user.username && (
                <Link
                  href={`/people/${user.username}` as Route}
                  className="inline-block text-xs text-primary hover:underline"
                >
                  {"Посмотреть общедоступный профиль "}</Link>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={"Операционные детали"}
            description={"Специальности, языки и часовой пояс указаны в вашем внутреннем профиле."}
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="acc-timezone">{"Часовой пояс"}</Label>
                  <IconInput
                    icon={Globe}
                    id="acc-timezone"
                    value={timezone}
                    onChange={(e) => {
                      setTimezone(e.target.value);
                      markDirty();
                    }}
                    placeholder="America/Sao_Paulo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acc-capacity">{"Производительность (часов/неделю)"}</Label>
                  <IconInput
                    icon={Clock}
                    id="acc-capacity"
                    type="number"
                    min={0}
                    max={168}
                    value={capacity}
                    onChange={(e) => {
                      setCapacity(e.target.value);
                      markDirty();
                    }}
                    placeholder="40"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-specialties">{"Специальности"}</Label>
                <IconInput
                  icon={Sparkles}
                  id="acc-specialties"
                  value={specialtiesText}
                  onChange={(e) => {
                    setSpecialtiesText(e.target.value);
                    markDirty();
                  }}
                  placeholder={"Технический сорсинг, Поиск руководителей"}
                />
                <p className="text-xs text-muted-foreground">
                  {"Через запятую. "}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-languages">{"Языки"}</Label>
                <IconInput
                  icon={Languages}
                  id="acc-languages"
                  value={languagesText}
                  onChange={(e) => {
                    setLanguagesText(e.target.value);
                    markDirty();
                  }}
                  placeholder={"английский, испанский"}
                />
                <p className="text-xs text-muted-foreground">
                  {"Через запятую. "}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={"Еженедельная доступность"}
            description={"Диапазоны в формате ЧЧ:мм-ЧЧ:мм, разделенные запятыми, для нескольких диапазонов в день."}
          >
            <div className="space-y-3">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="grid grid-cols-[3rem_1fr] items-center gap-3"
                >
                  <Label
                    htmlFor={`acc-avail-${day}`}
                    className="text-xs text-muted-foreground"
                  >
                    {DAY_LABELS[day]}
                  </Label>
                  <Input
                    id={`acc-avail-${day}`}
                    value={availabilityText[day]}
                    onChange={(e) => {
                      setAvailabilityText((prev) => ({
                        ...prev,
                        [day]: e.target.value,
                      }));
                      markDirty();
                    }}
                    placeholder="09:00-17:00"
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          {profileDirty ? (
            <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-xl border border-pine/30 bg-card px-5 py-3.5 shadow-[0_8px_24px_-12px_rgba(31,41,38,0.25)]">
              <p className="text-sm text-muted-foreground">
                {"У вас есть несохраненные изменения. "}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const resetName = splitPersonName(user.name);
                    setFirstName(resetName.firstName);
                    setLastName(resetName.lastName);
                    setImage(user.image ?? "");
                    setJobTitle(user.jobTitle ?? "");
                    setPhone(user.phone ?? "");
                    setLocation(user.location ?? "");
                    setBio(user.bio ?? "");
                    setLinkedinUrl(user.linkedinUrl ?? "");
                    setGithubUrl(user.githubUrl ?? "");
                    setWebsiteUrl(user.websiteUrl ?? "");
                    setTimezone(user.timezone ?? "");
                    setSpecialtiesText((user.specialties ?? []).join(", "));
                    setLanguagesText((user.languages ?? []).join(", "));
                    setCapacity(
                      user.capacityHoursPerWeek != null
                        ? String(user.capacityHoursPerWeek)
                        : "",
                    );
                    const week = user.weeklyAvailability ?? emptyWeek();
                    setAvailabilityText(
                      Object.fromEntries(
                        WEEKDAYS.map((day) => [
                          day,
                          formatDayRanges(week[day] ?? []),
                        ]),
                      ) as Record<keyof WeeklyAvailability, string>,
                    );
                    setProfileDirty(false);
                  }}
                  disabled={demoLocked || savingProfile}
                >
                  {"Отбросить "}</Button>
                <Button
                  size="sm"
                  onClick={saveProfile}
                  disabled={demoLocked || savingProfile}
                >
                  <PencilLine className="size-4" />
                  {savingProfile ? "Сохранение…" : "Сохранить профиль"}
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* ─── SECURITY TAB ─── */}
        <TabsContent value="security" className="mt-6 space-y-6">
          <SectionCard
            title={"Адрес электронной почты"}
            description={"Ваш основной адрес электронной почты, используемый для входа и уведомлений."}
            action={
              <Button
                variant="outline"
                onClick={saveEmail}
                disabled={demoLocked || savingEmail || !newEmail.trim()}
              >
                {savingEmail ? "Обновление…" : "Обновить адрес электронной почты"}
              </Button>
            }
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                <AtSign className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">{user.email}</span>
                <Badge variant="secondary" className="shrink-0">
                  {"Текущий "}</Badge>
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-email">{"Новое письмо"}</Label>
                <IconInput
                  icon={Mail}
                  id="acc-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={"Пароль"}
            description={"Изменение пароля приводит к выходу из каждого второго сеанса."}
            action={
              <Button
                variant="outline"
                onClick={savePassword}
                disabled={demoLocked || savingPassword || !canSavePassword}
              >
                {savingPassword ? "Сохранение…" : "Изменить пароль"}
              </Button>
            }
          >
            <div className="space-y-4">
              <PasswordField
                id="acc-current"
                label={"Текущий пароль"}
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                icon={LockKeyhole}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <PasswordField
                  id="acc-new"
                  label={"Новый пароль"}
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  icon={LockKeyhole}
                />
                <PasswordField
                  id="acc-confirm"
                  label={"Подтвердите новый пароль"}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  icon={LockKeyhole}
                />
              </div>
              <p
                className={cn(
                  "text-xs",
                  passwordsMismatch
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {passwordsMismatch
                  ? "Новый пароль и подтверждение не совпадают."
                  : "Используйте 8+ символов."}
              </p>
            </div>
          </SectionCard>

          {securitySlot}
        </TabsContent>

        {/* ─── SESSION TAB ─── */}
        <TabsContent value="session" className="mt-6 space-y-6">
          <SectionCard title={"Активные сессии"}>
            <div className="space-y-3">
              {sessions.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Globe className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.current ? "Текущий браузер" : "Другое устройство"}</p><p className="truncate text-xs text-muted-foreground">{item.userAgent ?? "Неизвестный браузер"}{item.ipAddress ? ` · ${item.ipAddress}` : ""}</p><p className="text-[11px] text-muted-foreground">{"Последний активный "}{item.updatedAt.toLocaleString("ru-RU")}</p></div>
                  {item.current ? <Badge variant="secondary" className="shrink-0">{"Это устройство"}</Badge> : <Button type="button" size="sm" variant="outline" onClick={() => revokeSession(item.id)}>{"Отозвать"}</Button>}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {"Выход из системы завершит этот сеанс. Используйте «Выйти везде» в настройках, чтобы отменить все сеансы. "}</p>
              {sessions.some((item) => !item.current) ? <Button type="button" variant="outline" onClick={() => startSignOut(async () => { const result = await revokeOtherMySessionsAction(); if (result.ok) { toast.success("Остальные заседания отменены."); router.refresh(); } })}>{"Выйти везде"}</Button> : null}
            </div>
          </SectionCard>

          <Card className="overflow-hidden border-destructive/20 gap-0 py-0">
            <CardHeader className="border-b border-destructive/10 bg-destructive/[0.03] px-6 py-3">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <LogOut className="size-4" />
                {"Опасная зона "}</CardTitle>
              <CardDescription>
                {"Завершите текущий сеанс на этом устройстве. "}</CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {"Вам нужно будет снова войти в систему, чтобы получить доступ к своей учетной записи. "}</p>
                <Button
                  variant="outline"
                  className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  <LogOut className="size-4" />
                  {signingOut ? "Выход из системы…" : "Выйти"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AvatarCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        imageSrc={cropSrc}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
