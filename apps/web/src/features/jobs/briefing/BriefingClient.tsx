"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { JobDraft } from "@/lib/ai/schemas";
import {
  answerJobBriefAction,
  compileJobBriefAction,
  createJobBriefAction,
  generateDescriptionFromBriefAction,
} from "./actions";
import { briefTopics, profileAsText, type BriefAnswer, type BriefProfile } from "./model";

export function NewBriefingClient() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createJobBriefAction({ title });
      if (!result.ok) return setError(result.error);
      router.push(`/dashboard/jobs/briefs/${result.briefId}`);
    });
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <div className="space-y-2">
        <Link href="/dashboard/jobs" className="text-sm text-muted-foreground underline">← Вакансии</Link>
        <h1 className="text-3xl font-semibold">Профиль позиции</h1>
        <p className="text-muted-foreground">Начните с названия роли. Затем ИИ задаст руководителю вопросы и подготовит внутренний профиль до публикации вакансии.</p>
      </div>
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <label htmlFor="brief-title" className="block font-medium">Кого планируете нанять?</label>
        <Input id="brief-title" value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="Например, врач-стоматолог терапевт" onKeyDown={(event) => { if (event.key === "Enter") create(); }} />
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button onClick={create} disabled={busy || title.trim().length < 3}>Начать брифинг <ArrowRight className="size-4" /></Button>
      </div>
    </main>
  );
}

export function BriefingClient({
  briefId,
  title,
  initialAnswers,
  initialQuestion,
  initialProfile,
  initialDraft,
  aiConfigured,
}: {
  briefId: string;
  title: string;
  initialAnswers: BriefAnswer[];
  initialQuestion: string | null;
  initialProfile: BriefProfile | null;
  initialDraft: JobDraft | null;
  aiConfigured: boolean;
}) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState("");
  const [profile, setProfile] = useState(initialProfile);
  const [draft, setDraft] = useState(initialDraft);
  const [message, setMessage] = useState("");
  const [busy, startTransition] = useTransition();
  const complete = answers.length === briefTopics.length;
  const activeQuestion = question ?? briefTopics[answers.length]?.question;

  function sendAnswer() {
    startTransition(async () => {
      setMessage("");
      const result = await answerJobBriefAction({ briefId, answer });
      if (!result.ok) return setMessage(result.error);
      setAnswers(result.answers);
      setQuestion(result.nextQuestion);
      setAnswer("");
    });
  }

  function compile() {
    startTransition(async () => {
      setMessage("");
      const result = await compileJobBriefAction({ briefId });
      if (!result.ok) return setMessage(result.error);
      setProfile(result.profile);
      if (!result.aiUsed) setMessage("Профиль составлен из ответов руководителя. После настройки ИИ можно получить обработанную версию.");
    });
  }

  function generate() {
    startTransition(async () => {
      setMessage("");
      const result = await generateDescriptionFromBriefAction({ briefId });
      if (!result.ok) return setMessage(result.error);
      setDraft(result.draft);
    });
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <Link href="/dashboard/jobs" className="text-sm text-muted-foreground underline">← Вакансии</Link>
      <div>
        <p className="text-sm text-muted-foreground">Брифинг руководителя · {answers.length} из {briefTopics.length} вопросов</p>
        <h1 className="text-3xl font-semibold">{title}</h1>
      </div>
      {!aiConfigured ? <p className="rounded-xl border border-border bg-muted p-4 text-sm">ИИ пока не настроен. Вопросы и профиль доступны; для адаптивных вопросов и генерации описания подключите OpenRouter в настройках ИИ.</p> : null}
      {answers.map((item, index) => (
        <div key={`${item.topic}-${index}`} className="space-y-2 rounded-2xl border bg-card p-5">
          <p className="font-medium">{item.question}</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{item.answer}</p>
        </div>
      ))}
      {!complete && activeQuestion ? (
        <section className="space-y-4 rounded-2xl border border-primary/30 bg-card p-5">
          <div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /><h2 className="font-medium">{activeQuestion}</h2></div>
          <Textarea aria-label="Ответ руководителя" value={answer} maxLength={5000} rows={5} placeholder="Ответьте своими словами. Можно перечислить несколько пунктов." onChange={(event) => setAnswer(event.target.value)} />
          <Button onClick={sendAnswer} disabled={busy || answer.trim().length < 2}>Ответить <ArrowRight className="size-4" /></Button>
        </section>
      ) : null}
      {complete && !profile ? <Button onClick={compile} disabled={busy}>Составить профиль позиции</Button> : null}
      {profile ? (
        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-xl font-semibold">Внутренний профиль позиции</h2>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{profileAsText(profile)}</pre>
          {!draft ? <Button onClick={generate} disabled={busy || !aiConfigured}>Сгенерировать описание вакансии</Button> : null}
        </section>
      ) : null}
      {draft ? (
        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-xl font-semibold">Черновик описания</h2>
          <p>{draft.summary}</p>
          {draft.sections.map((section, index) => <div key={`${section.title}-${index}`}><h3 className="font-medium">{section.title}</h3><ul className="list-disc pl-5">{section.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}</ul></div>)}
          <Button asChild><Link href={`/dashboard/jobs/new?briefId=${briefId}`}>Создать вакансию из профиля <ArrowRight className="size-4" /></Link></Button>
        </section>
      ) : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    </main>
  );
}
