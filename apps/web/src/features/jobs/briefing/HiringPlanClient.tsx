"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RussianFileInput } from "./RussianFileInput";
import type { JobDraft } from "@/lib/ai/schemas";
import { briefTopics, type BriefAnswer } from "./model";
import {
  categoryLabels,
  verificationLabels,
  statusLabels,
  reviewReference,
  type EmployeeProfile,
  type HiringIntake,
  type ResumeReview,
} from "./workflow";
import { callCenterCase, sampleResumes } from "./call-center";
import {
  chatHiringPlanAction,
  compileEmployeeProfileAction,
  createCallCenterPlanAction,
  generateHiringDescriptionAction,
  listPlanCandidatesAction,
  reviewHiringResumeAction,
  saveEmployeeProfileAction,
  saveHiringDescriptionAction,
  extractPlanResumeAction,
  createBriefingInviteAction,
  revokeBriefingInviteAction,
  attachBriefSourceAction,
  completePlanBriefingAction,
  editPlanAnswersAction,
} from "./workflow-actions";

export function CallCenterEntry() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          start(async () => {
            try {
              const result = await createCallCenterPlanAction();
              router.push(`/dashboard/jobs/briefs/${result.briefId}`);
            } catch {
              setError("Не удалось открыть пример. Повторите попытку.");
            }
          })
        }
      >
        {busy ? "Открываем…" : "Пример подбора в колл-центр"}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

const sections = [
  ["outcomes", "Ожидаемые результаты"],
  ["responsibilities", "Ежедневные задачи"],
  ["mustHave", "Обязательные требования"],
  ["niceToHave", "Желательные требования"],
  ["conditions", "Условия работы"],
  ["selection", "Как проверять на интервью"],
] as const;
const panel = "space-y-4 rounded-2xl border bg-card p-5";

export function HiringPlanClient({
  initialVersion,
  initialInvitations,
  initialStep,
  initialCandidateId,
  initialCandidateName,
  briefId,
  title,
  initialAnswers,
  initialIntake,
  initialProfile,
  initialDraft,
  initialReviews,
  jobId,
  aiConfigured,
}: {
  initialVersion: string;
  initialStep: number;
  initialCandidateId: string;
  initialCandidateName: string;
  initialInvitations: Array<{
    id: string;
    expiresAt: string;
    revokedAt: string | null;
    completedAt: string | null;
    expired: boolean;
  }>;
  briefId: string;
  title: string;
  initialAnswers: BriefAnswer[];
  initialIntake: HiringIntake;
  initialProfile: EmployeeProfile | null;
  initialDraft: JobDraft | null;
  initialReviews: ResumeReview[];
  jobId: string | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [step, setStepState] = useState(initialStep);
  function setStep(value: number) {
    setStepState(value);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?step=${value}`,
    );
  }
  const [version, setVersion] = useState(initialVersion);
  const [inviteUrl, setInviteUrl] = useState("");
  const [pendingRequest, setPendingRequest] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [answers, setAnswers] = useState(initialAnswers);
  const [intake, setIntake] = useState(initialIntake);
  const [profile, setProfile] = useState(initialProfile);
  const [draft, setDraft] = useState(initialDraft);
  const [profileDirty, setProfileDirty] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [reviews, setReviews] = useState(initialReviews);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, start] = useTransition();
  const [candidateName, setCandidateName] = useState(initialCandidateName);
  const [resumeText, setResumeText] = useState("");
  const [candidateId, setCandidateId] = useState(initialCandidateId);
  const [savedCandidates, setSavedCandidates] = useState<
    Array<{ id: string; firstName: string; lastName: string }>
  >([]);
  const [lastServerVersion, setLastServerVersion] = useState(initialVersion);
  if (initialVersion !== lastServerVersion) {
    setLastServerVersion(initialVersion);
    if (initialVersion !== version) {
      setVersion(initialVersion);
      setAnswers(initialAnswers);
      setIntake(initialIntake);
      setProfile(initialProfile);
      setDraft(initialDraft);
      setReviews(initialReviews);
      setProfileDirty(false);
      setDraftDirty(false);
    }
  }
  const ready =
    intake.profileApproved &&
    intake.vacancyApproved &&
    !profileDirty &&
    !draftDirty;
  const reference = profile && draft ? reviewReference(profile, draft) : "";
  function run(operation: () => Promise<void>) {
    setNotice("");
    start(async () => {
      try {
        await operation();
      } catch {
        setNotice(
          "Не удалось выполнить действие. Ваш ввод остался на месте. Повторите попытку.",
        );
      }
    });
  }
  function editProfile(next: EmployeeProfile) {
    setProfile(next);
    setProfileDirty(true);
  }
  function editDraft(next: JobDraft) {
    setDraft(next);
    setDraftDirty(true);
  }
  function send() {
    run(async () => {
      const id =
        pendingRequest?.message === message
          ? pendingRequest.id
          : crypto.randomUUID();
      setPendingRequest({ id, message });
      const result = await chatHiringPlanAction({
        briefId,
        message,
        requestId: id,
        expectedVersion: version,
      });
      if (!result.ok) {
        router.refresh();
        return setNotice(result.error);
      }
      setPendingRequest(null);
      setVersion(result.updatedAt);
      setAnswers(result.answers);
      setIntake(result.intake);
      setProfile(null);
      setDraft(null);
      setProfileDirty(false);
      setDraftDirty(false);
      setMessage("");
    });
  }
  function compile() {
    run(async () => {
      const result = await compileEmployeeProfileAction({
        briefId,
        expectedVersion: version,
      });
      if (!result.ok) return setNotice(result.error);
      setVersion(result.updatedAt);
      setProfile(result.profile);
      setIntake(result.intake);
      setDraft(null);
      setProfileDirty(false);
      setDraftDirty(false);
      setStep(2);
      if (!result.aiUsed)
        setNotice(
          "Профиль собран из ответов без ИИ. Проверьте и утвердите критерии.",
        );
    });
  }
  const historicMessages = answers.flatMap((answer) => [
    { role: "assistant" as const, content: answer.question },
    { role: "user" as const, content: answer.answer },
  ]);
  const chat = intake.messages.length ? intake.messages : historicMessages;
  const unanswered = briefTopics.filter(
    (topic) => !answers.some((answer) => answer.topic === topic.key),
  );
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        href="/dashboard/jobs"
        className="text-sm text-muted-foreground underline"
      >
        ← Вакансии и планы подбора
      </Link>
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">План подбора</p>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">
          Требования руководителя связывают профиль, вакансию и каждый разбор
          резюме.
        </p>
      </header>
      <nav
        aria-label="Этапы плана подбора"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {[
          "Чат с руководителем",
          "Профиль сотрудника",
          "Описание вакансии",
          "Разбор резюме",
        ].map((label, index) => (
          <Button
            key={label}
            variant={step === index + 1 ? "default" : "outline"}
            aria-current={step === index + 1 ? "step" : undefined}
            disabled={busy}
            onClick={() => setStep(index + 1)}
            className="h-auto whitespace-normal py-3"
          >
            {index + 1}. {label}
          </Button>
        ))}
      </nav>
      {!aiConfigured && (
        <p className="rounded-xl border bg-muted p-4 text-sm">
          ИИ не настроен. Доступно редактирование профиля. Для агентского чата,
          генерации и анализа подключите провайдера в{" "}
          <Link className="underline" href="/settings/ai">
            настройках ИИ
          </Link>
          .
        </p>
      )}
      {intake.caseId === callCenterCase.id && (
        <details className={panel}>
          <summary className="cursor-pointer font-semibold">
            Реальный кейс Артдент: 1 033 отклика → 2 выхода
          </summary>
          <p className="text-sm text-muted-foreground">
            {callCenterCase.source}. {callCenterCase.period}. Это исторические
            агрегаты, а не кандидаты текущей воронки Harly.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {callCenterCase.funnel.map((item) => (
              <div key={item.label} className="rounded-lg border p-3">
                <strong className="block text-xl">
                  {item.count.toLocaleString("ru-RU")}
                </strong>
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
          </div>
          <p>
            Размещение: около 8 000 ₽. Это около 4 000 ₽ на вышедшего
            сотрудника, без учёта времени команды и других расходов.
          </p>
          <p className="text-sm text-muted-foreground">
            {callCenterCase.dateNote}
          </p>
          <h3 className="font-medium">Что уточнить у руководителя</h3>
          <ul className="list-disc pl-5">
            {callCenterCase.unanswered.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-sm">
            В исходном подборе руководителю передавали только резюме. Здесь к
            нему добавляется проверяемая матрица требований и вопросы для
            интервью. Образцы резюме подготовлены для демонстрации.
          </p>
        </details>
      )}
      {step === 1 && (
        <section className={panel} aria-label="Брифинг руководителя">
          <h2 className="text-xl font-semibold">
            1. Требования от руководителя
          </h2>
          <div className="space-y-3 rounded-xl border bg-muted p-4">
            <p className="font-medium">
              Руководитель проходит брифинг без аккаунта
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const result = await createBriefingInviteAction(briefId);
                    setInviteUrl(result.url);
                    setVersion(result.updatedAt);
                    setIntake((v) => ({ ...v, completed: false }));
                    router.refresh();
                  })
                }
              >
                Создать внешнюю ссылку
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => router.refresh()}
              >
                Обновить ответы руководителя
              </Button>
            </div>
            {inviteUrl && (
              <div className="space-y-2">
                <label htmlFor="invite-url" className="text-sm">
                  Скопируйте и передайте ссылку руководителю
                </label>
                <Input id="invite-url" readOnly value={inviteUrl} />
                <Button
                  variant="outline"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(inviteUrl)
                      .then(() => setNotice("Ссылка скопирована."))
                      .catch(() =>
                        setNotice("Выделите и скопируйте ссылку вручную."),
                      )
                  }
                >
                  Скопировать
                </Button>
                <p className="text-xs text-muted-foreground">
                  Ссылка даёт доступ только к этому брифингу и действует семь
                  дней. Полный адрес показывается только при создании.
                </p>
              </div>
            )}
            {initialInvitations.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <span>
                  До {new Date(invite.expiresAt).toLocaleDateString("ru-RU")} ·{" "}
                  {invite.revokedAt
                    ? "Отозвана"
                    : invite.expired
                      ? "Истекла"
                      : invite.completedAt
                        ? "Брифинг передан HR"
                        : "Доступна"}
                </span>
                {!invite.revokedAt && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await revokeBriefingInviteAction(briefId, invite.id);
                        router.refresh();
                      })
                    }
                  >
                    Отозвать
                  </Button>
                )}
              </div>
            ))}
            {intake.completed && (
              <p>
                Руководитель подтвердил брифинг и передал его HR. Можно
                формировать профиль.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="brief-source" className="text-sm font-medium">
              Исходные материалы для руководителя (PDF, DOCX или TXT до 10 МБ)
            </label>
            <RussianFileInput
              id="brief-source"
              accept=".pdf,.docx,.txt"
              disabled={busy || intake.completed}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const data = new FormData();
                data.set("file", file);
                data.set("briefId", briefId);
                data.set("expectedVersion", version);
                run(async () => {
                  const result = await attachBriefSourceAction(data);
                  setIntake(result.intake);
                  setVersion(result.updatedAt);
                  setNotice(
                    "Документ сохранён. Агент учтёт его в следующем сообщении.",
                  );
                });
                event.target.value = "";
              }}
            />
            {intake.sourceDocuments.map((d, i) => (
              <details key={i}>
                <summary className="cursor-pointer text-sm">{d.name}</summary>
                <p className="whitespace-pre-wrap text-sm">{d.text}</p>
              </details>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Ответьте свободно: можно рассказать сразу о задачах, опыте и
            условиях, уточнить или исправить предыдущий ответ. Изменение
            требований потребует повторного утверждения профиля и описания.
          </p>
          <div
            className="max-h-[480px] space-y-3 overflow-y-auto"
            aria-label="История чата"
          >
            {chat.map((item, index) => (
              <article
                key={index}
                className={`rounded-xl border p-4 ${item.role === "user" ? "ml-6 bg-muted" : "mr-6 bg-background"}`}
              >
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {item.role === "user" ? "Руководитель" : "HR-партнёр"}
                </p>
                <p className="whitespace-pre-wrap">{item.content}</p>
              </article>
            ))}
            {!chat.length && <p>{briefTopics[0].question}</p>}
          </div>
          <p className="text-sm">
            Сводка требований: {answers.length} из 7.{" "}
            {unanswered.length
              ? "ИИ уточнит недостающие сведения."
              : "Можно сформировать профиль или уточнить требования."}
          </p>
          <label className="block font-medium" htmlFor="manager-message">
            Сообщение руководителя
          </label>
          <Textarea
            id="manager-message"
            rows={4}
            value={message}
            maxLength={5000}
            disabled={busy}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Расскажите, кого ищете и какой результат нужен…"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || intake.completed || message.trim().length < 2}
              onClick={send}
            >
              {busy ? "Обрабатываем…" : "Отправить"}
            </Button>
            <Button
              variant="outline"
              disabled={
                busy || answers.length === 0 || message.trim().length > 0
              }
              onClick={compile}
            >
              Сформировать профиль сотрудника
            </Button>
          </div>
          <details>
            <summary className="cursor-pointer text-sm">
              Собранные требования и источники
            </summary>
            {answers.map((item, index) => (
              <div key={item.topic} className="mt-3 space-y-2 text-sm">
                <label
                  htmlFor={`brief-answer-${index}`}
                  className="font-medium"
                >
                  {item.question}
                </label>
                <Textarea
                  id={`brief-answer-${index}`}
                  value={item.answer}
                  maxLength={5000}
                  disabled={busy || intake.completed}
                  onChange={(e) =>
                    setAnswers((prev) =>
                      prev.map((a) =>
                        a.topic === item.topic
                          ? { ...a, answer: e.target.value }
                          : a,
                      ),
                    )
                  }
                />
                {intake.sources
                  .filter((s) => s.topic === item.topic)
                  .slice(-2)
                  .map((source, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {source.kind === "manager"
                        ? "Ответ руководителя"
                        : source.kind === "document"
                          ? "Исходный документ"
                          : "Гипотеза"}
                      : {source.quote || "Требует согласования"}
                    </p>
                  ))}
              </div>
            ))}
            <Button
              variant="outline"
              disabled={busy || intake.completed}
              onClick={() =>
                run(async () => {
                  const result = await editPlanAnswersAction({
                    briefId,
                    answers,
                    expectedVersion: version,
                  });
                  setVersion(result.updatedAt);
                  setProfile(null);
                  setDraft(null);
                  setNotice(
                    "Исправления сохранены. Сформируйте профиль заново.",
                  );
                  router.refresh();
                })
              }
            >
              Сохранить исправления брифа
            </Button>
          </details>
          {intake.openQuestions.length > 0 && (
            <div>
              <h3 className="font-medium">Открытые вопросы</h3>
              <ul className="list-disc pl-5">
                {intake.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {!intake.completed && answers.length > 0 && (
            <Button
              variant="outline"
              disabled={busy || Boolean(message.trim())}
              onClick={() =>
                run(async () => {
                  const result = await completePlanBriefingAction(
                    briefId,
                    version,
                  );
                  setVersion(result.updatedAt);
                  setIntake((v) => ({ ...v, completed: true }));
                  setNotice("Брифинг подтверждён. Можно сформировать профиль.");
                  router.refresh();
                })
              }
            >
              Подтвердить итог брифинга
            </Button>
          )}
        </section>
      )}
      {step === 2 && (
        <section className={panel}>
          <h2 className="text-xl font-semibold">2. Профиль сотрудника</h2>
          {!profile ? (
            <>
              <p>Сначала соберите требования в чате.</p>
              <Button disabled={busy || answers.length === 0} onClick={compile}>
                Сформировать профиль
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {intake.profileApproved && !profileDirty
                  ? "Профиль утверждён."
                  : "Гипотеза профиля. Проверьте и утвердите её перед генерацией вакансии."}{" "}
                Поведенческие качества проверяются рабочими ситуациями.
              </p>
              <label className="block font-medium" htmlFor="profile-purpose">
                Цель найма
              </label>
              <Textarea
                id="profile-purpose"
                value={profile.purpose}
                disabled={busy}
                maxLength={5000}
                onChange={(event) =>
                  editProfile({ ...profile, purpose: event.target.value })
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {sections.map(([key, label]) => (
                  <div key={key}>
                    <label
                      className="block font-medium"
                      htmlFor={`profile-${key}`}
                    >
                      {label}
                    </label>
                    <Textarea
                      id={`profile-${key}`}
                      rows={4}
                      value={profile[key].join("\n")}
                      disabled={busy}
                      maxLength={5000}
                      onChange={(event) =>
                        editProfile({
                          ...profile,
                          [key]: event.target.value.split("\n"),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <h3 className="font-semibold">Матрица проверки</h3>
              {profile.criteria.map((criterion, index) => (
                <div
                  className="space-y-2 rounded-xl border p-4"
                  key={criterion.id}
                >
                  <p className="text-xs text-muted-foreground">
                    {categoryLabels[criterion.category]} ·{" "}
                    {criterion.required ? "Обязательно" : "Желательно"} ·
                    Проверка: {verificationLabels[criterion.verification]}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label className="text-sm">
                      Категория{" "}
                      <select
                        className="rounded border bg-background p-1"
                        disabled={busy}
                        value={criterion.category}
                        onChange={(e) =>
                          editProfile({
                            ...profile,
                            criteria: profile.criteria.map((v, i) =>
                              i === index
                                ? {
                                    ...v,
                                    category: e.target
                                      .value as typeof v.category,
                                    verification:
                                      e.target.value === "behavioral" &&
                                      v.verification === "resume"
                                        ? "work_sample"
                                        : v.verification,
                                  }
                                : v,
                            ),
                          })
                        }
                      >
                        {Object.entries(categoryLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      Проверка{" "}
                      <select
                        className="rounded border bg-background p-1"
                        disabled={busy}
                        value={criterion.verification}
                        onChange={(e) =>
                          editProfile({
                            ...profile,
                            criteria: profile.criteria.map((v, i) =>
                              i === index
                                ? {
                                    ...v,
                                    verification: e.target
                                      .value as typeof v.verification,
                                  }
                                : v,
                            ),
                          })
                        }
                      >
                        {Object.entries(verificationLabels)
                          .filter(
                            ([key]) =>
                              criterion.category !== "behavioral" ||
                              key !== "resume",
                          )
                          .map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <input
                        type="checkbox"
                        checked={criterion.required}
                        disabled={busy}
                        onChange={(e) =>
                          editProfile({
                            ...profile,
                            criteria: profile.criteria.map((v, i) =>
                              i === index
                                ? { ...v, required: e.target.checked }
                                : v,
                            ),
                          })
                        }
                      />{" "}
                      Обязательно
                    </label>
                    <Button
                      variant="ghost"
                      disabled={busy || profile.criteria.length <= 1}
                      onClick={() =>
                        editProfile({
                          ...profile,
                          criteria: profile.criteria.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      Удалить
                    </Button>
                  </div>
                  <label htmlFor={`criterion-${index}`} className="sr-only">
                    Критерий {index + 1}
                  </label>
                  <Input
                    id={`criterion-${index}`}
                    value={criterion.label}
                    disabled={busy}
                    maxLength={500}
                    onChange={(event) =>
                      editProfile({
                        ...profile,
                        criteria: profile.criteria.map((item, i) =>
                          i === index
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <label htmlFor={`question-${index}`} className="text-sm">
                    Вопрос или практическое задание
                  </label>
                  <Textarea
                    id={`question-${index}`}
                    value={criterion.question}
                    disabled={busy}
                    maxLength={600}
                    onChange={(event) =>
                      editProfile({
                        ...profile,
                        criteria: profile.criteria.map((item, i) =>
                          i === index
                            ? { ...item, question: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </div>
              ))}
              <Button
                variant="outline"
                disabled={busy || profile.criteria.length >= 20}
                onClick={() =>
                  editProfile({
                    ...profile,
                    criteria: [
                      ...profile.criteria,
                      {
                        id: crypto.randomUUID(),
                        label: "Новый критерий",
                        category: "professional",
                        required: true,
                        verification: "interview",
                        question: "Как проверим этот критерий?",
                      },
                    ],
                  })
                }
              >
                Добавить критерий
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const result = await saveEmployeeProfileAction({
                      briefId,
                      profile,
                      expectedVersion: version,
                    });
                    if (!result.ok) return setNotice(result.error);
                    setVersion(result.updatedAt);
                    setProfile(result.profile);
                    setIntake(result.intake);
                    setProfileDirty(false);
                    if (result.draftCleared) {
                      setDraft(null);
                      setDraftDirty(false);
                    }
                    setStep(3);
                    setNotice("Профиль сохранён и утверждён.");
                  })
                }
              >
                Сохранить и утвердить профиль
              </Button>
            </>
          )}
        </section>
      )}
      {step === 3 && (
        <section className={panel}>
          <h2 className="text-xl font-semibold">3. Описание вакансии</h2>
          <p className="text-sm text-muted-foreground">
            Описание создаётся существующим генератором Harly из утверждённого
            профиля. Оно доступно для проверки до создания вакансии.
          </p>
          {(!intake.profileApproved || profileDirty) && (
            <p>Сначала сохраните и утвердите профиль на втором этапе.</p>
          )}
          <Button
            variant="outline"
            disabled={
              busy ||
              !aiConfigured ||
              !intake.profileApproved ||
              profileDirty ||
              draftDirty
            }
            onClick={() =>
              run(async () => {
                const result = await generateHiringDescriptionAction({
                  briefId,
                  expectedVersion: version,
                });
                if (!result.ok) return setNotice(result.error);
                setVersion(result.updatedAt);
                setDraft(result.draft);
                setIntake(result.intake);
                setDraftDirty(false);
              })
            }
          >
            {draft ? "Сгенерировать заново" : "Сгенерировать описание"}
          </Button>
          {draft && (
            <>
              <label className="block font-medium" htmlFor="vacancy-summary">
                Вводный текст
              </label>
              <Textarea
                id="vacancy-summary"
                rows={4}
                value={draft.summary}
                disabled={busy}
                maxLength={5000}
                onChange={(event) =>
                  editDraft({ ...draft, summary: event.target.value })
                }
              />
              {draft.sections.map((section, index) => (
                <div className="space-y-2" key={index}>
                  <label htmlFor={`section-${index}`} className="sr-only">
                    Название раздела {index + 1}
                  </label>
                  <Input
                    id={`section-${index}`}
                    value={section.title}
                    disabled={busy}
                    maxLength={160}
                    onChange={(event) =>
                      editDraft({
                        ...draft,
                        sections: draft.sections.map((item, i) =>
                          i === index
                            ? { ...item, title: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <label htmlFor={`bullets-${index}`} className="sr-only">
                    Пункты раздела {index + 1}
                  </label>
                  <Textarea
                    id={`bullets-${index}`}
                    rows={4}
                    value={section.bullets.join("\n")}
                    maxLength={5000}
                    disabled={busy}
                    onChange={(event) =>
                      editDraft({
                        ...draft,
                        sections: draft.sections.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                bullets: event.target.value.split("\n"),
                              }
                            : item,
                        ),
                      })
                    }
                  />
                </div>
              ))}
              <Button
                disabled={busy || !intake.profileApproved || profileDirty}
                onClick={() =>
                  run(async () => {
                    const result = await saveHiringDescriptionAction({
                      briefId,
                      draft,
                      expectedVersion: version,
                    });
                    if (!result.ok) return setNotice(result.error);
                    setVersion(result.updatedAt);
                    setDraft(result.draft);
                    setIntake(result.intake);
                    setDraftDirty(false);
                    setStep(4);
                    setNotice("Описание сохранено и утверждено.");
                  })
                }
              >
                Утвердить описание и перейти к резюме
              </Button>
              {ready && (
                <div>
                  {jobId ? (
                    <Link
                      className="underline"
                      href={`/dashboard/jobs/${jobId}`}
                    >
                      Открыть связанную вакансию
                    </Link>
                  ) : (
                    <Button asChild>
                      <Link href={`/dashboard/jobs/new?briefId=${briefId}`}>
                        Создать вакансию из описания
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}
      {step === 4 && (
        <section className={panel}>
          <h2 className="text-xl font-semibold">
            4. Разбор резюме по профилю и вакансии
          </h2>
          <p className="text-sm text-muted-foreground">
            Подтверждения с цитатами, расхождения и вопросы для интервью.
            Отсутствие сведений не означает отсутствие навыка. Решение принимает
            HR и руководитель.
          </p>
          {!ready && (
            <p>
              Для нового разбора утвердите профиль и описание на предыдущих
              этапах.
            </p>
          )}
          {intake.caseId === callCenterCase.id && (
            <div>
              <p className="mb-2 text-sm font-medium">Образцы резюме</p>
              <div className="flex flex-wrap gap-2">
                {sampleResumes.map((sample) => (
                  <Button
                    key={sample.name}
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setCandidateId("");
                      setCandidateName(sample.name);
                      setResumeText(sample.text);
                    }}
                  >
                    {sample.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {jobId && (
            <div className="space-y-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const rows = await listPlanCandidatesAction(briefId);
                    setSavedCandidates(rows);
                    if (!rows.length)
                      setNotice(
                        "У связанной вакансии пока нет доступных кандидатов.",
                      );
                  })
                }
              >
                Выбрать резюме из Harly
              </Button>
              {savedCandidates.length > 0 && (
                <>
                  <label htmlFor="plan-candidate" className="sr-only">
                    Кандидат из Harly
                  </label>
                  <select
                    id="plan-candidate"
                    className="w-full rounded-lg border bg-background p-2"
                    disabled={busy}
                    value={candidateId}
                    onChange={(event) => {
                      const id = event.target.value;
                      setCandidateId(id);
                      const candidate = savedCandidates.find(
                        (item) => item.id === id,
                      );
                      if (candidate)
                        setCandidateName(
                          `${candidate.firstName} ${candidate.lastName}`,
                        );
                    }}
                  >
                    <option value="">Вставить резюме вручную</option>
                    {savedCandidates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
          <label htmlFor="resume-name" className="block font-medium">
            Имя кандидата
          </label>
          <Input
            id="resume-name"
            value={candidateName}
            maxLength={160}
            disabled={busy || Boolean(candidateId)}
            onChange={(event) => setCandidateName(event.target.value)}
          />
          {!candidateId && (
            <>
              <label
                htmlFor="resume-file"
                className="block text-sm font-medium"
              >
                Загрузить резюме (PDF, DOCX или TXT)
              </label>
              <RussianFileInput
                id="resume-file"
                accept=".pdf,.docx,.txt"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const data = new FormData();
                  data.set("file", file);
                  run(async () => {
                    const result = await extractPlanResumeAction(data);
                    if (!result.ok) return setNotice(result.error);
                    setResumeText(result.text);
                    setNotice("Текст извлечён. Проверьте его перед разбором.");
                  });
                  event.target.value = "";
                }}
              />
              <label htmlFor="resume-text" className="block font-medium">
                Текст резюме
              </label>
              <Textarea
                id="resume-text"
                rows={9}
                value={resumeText}
                maxLength={20000}
                disabled={busy}
                onChange={(event) => setResumeText(event.target.value)}
              />
            </>
          )}
          <Button
            disabled={
              busy ||
              !ready ||
              !aiConfigured ||
              candidateName.trim().length < 2 ||
              (!candidateId && resumeText.trim().length < 50)
            }
            onClick={() =>
              run(async () => {
                const result = await reviewHiringResumeAction({
                  briefId,
                  candidateName,
                  resumeText,
                  expectedVersion: version,
                  ...(candidateId ? { candidateId } : {}),
                });
                if (!result.ok) return setNotice(result.error);
                setVersion(result.updatedAt);
                setReviews((previous) => [...previous, result.review]);
                setNotice(
                  "Разбор сохранён. Проверьте доказательства и вопросы ниже.",
                );
              })
            }
          >
            {busy ? "Разбираем резюме…" : "Сопоставить с профилем и вакансией"}
          </Button>
          <h3 className="font-semibold">Сохранённые разборы</h3>
          {reviews.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Пока нет разборов. Загрузите резюме или выберите образец.
            </p>
          )}
          {[...reviews].reverse().map((review) => (
            <article
              key={review.id}
              className="space-y-3 rounded-xl border p-4"
            >
              <h4 className="text-lg font-semibold">{review.candidateName}</h4>
              <p className="text-xs text-muted-foreground">
                {new Date(review.createdAt).toLocaleString("ru-RU")} ·{" "}
                {
                  review.assessments.filter(
                    (item) => item.status === "confirmed",
                  ).length
                }{" "}
                подтверждений ·{" "}
                {
                  review.assessments.filter(
                    (item) => item.status === "unverified",
                  ).length
                }{" "}
                вопросов для проверки
              </p>
              {(review.reference !== reference || !ready) && (
                <p className="rounded-lg bg-muted p-3 text-sm">
                  Разбор относится к прежней версии требований. После
                  утверждения изменений выполните новый разбор.
                </p>
              )}
              <p>{review.summary}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Матрица соответствия резюме требованиям
                  </caption>
                  <thead>
                    <tr>
                      <th className="p-2">Критерий</th>
                      <th className="p-2">Подтверждения и проверка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.assessments.map((assessment) => {
                      const criterion = review.criteria.find(
                        (item) => item.id === assessment.id,
                      );
                      return (
                        <tr key={assessment.id} className="border-t">
                          <td className="p-2 align-top">
                            <strong>{criterion?.label}</strong>
                            <p className="text-xs text-muted-foreground">
                              {criterion &&
                                verificationLabels[criterion.verification]}
                            </p>
                          </td>
                          <td className="space-y-1 p-2 align-top">
                            <p className="font-medium">
                              {statusLabels[assessment.status]}
                            </p>
                            {assessment.evidence && (
                              <blockquote className="border-l-2 pl-3">
                                «{assessment.evidence}»
                              </blockquote>
                            )}
                            <p>{assessment.explanation}</p>
                            <p className="text-muted-foreground">
                              Уточнить: {assessment.question}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <details>
                <summary className="cursor-pointer text-sm">
                  Исходное резюме
                </summary>
                <p className="whitespace-pre-wrap text-sm">
                  {review.resumeText}
                </p>
              </details>
              {review.candidateId && (
                <Link
                  className="text-sm underline"
                  href={`/dashboard/candidates/${review.candidateId}`}
                >
                  Карточка кандидата
                </Link>
              )}
            </article>
          ))}
        </section>
      )}
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          Выполняем запрос. Дождитесь завершения; результат будет сохранён в
          плане.
        </p>
      )}
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border bg-muted p-4 text-sm"
        >
          {notice}
        </p>
      )}
    </main>
  );
}
