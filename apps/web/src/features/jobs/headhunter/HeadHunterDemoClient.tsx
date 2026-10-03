"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { importDemoHhResponsesAction } from "./actions";
import type { HhResponse } from "./mock";

export function HeadHunterDemoClient({ jobId, title, responses }: {
  jobId: string;
  title: string;
  responses: HhResponse[];
}) {
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  function importResponses() {
    startTransition(async () => {
      const result = await importDemoHhResponsesAction(jobId);
      setMessage(result.ok
        ? `Импортировано откликов: ${result.imported}. Уже были в системе: ${result.skipped}.`
        : result.error);
    });
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
    <Link href={`/dashboard/jobs/${jobId}`} className="text-sm text-muted-foreground underline">← Вакансия</Link>
    <div><h1 className="text-3xl font-semibold">HeadHunter · демо</h1><p className="mt-2 text-muted-foreground">{title}</p></div>
    <p className="rounded-xl border bg-muted p-4 text-sm">Это демонстрация на вымышленных данных. Никаких запросов к hh.ru нет; публикация вакансии и OAuth работодателя будут добавлены на следующем этапе.</p>
    <section className="rounded-2xl border bg-card p-5 space-y-3">
      <h2 className="font-semibold">Тестовые отклики</h2>
      {responses.map((response) => <div key={response.externalId} className="rounded-lg border p-3">
        <p className="font-medium">{response.firstName} {response.lastName}</p>
        <p className="text-sm text-muted-foreground">{response.headline}</p>
      </div>)}
      <Button onClick={importResponses} disabled={busy}>Импортировать в воронку</Button>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </section>
  </main>;
}
