import Link from "next/link";
import type { Route } from "next";
import { Briefcase, Plus, TrendingUp, Trash2, Users } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  listJobsWithStats,
  listTrashedJobs,
} from "@/features/jobs/data";
import { JobsTable } from "@/features/jobs/JobsTable";
import { listJobBriefs } from "@/features/jobs/briefing/actions";
import { JobIdentity } from "@/features/jobs/JobIdentity";
import { TrashJobActions } from "@/features/jobs/TrashJobActions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type JobsPageProps = {
  searchParams: Promise<{ view?: string }>;
};

const tileClass =
  "rounded-2xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(28,27,22,0.04)]";

export default async function DashboardJobsPage({ searchParams }: JobsPageProps) {
  const { view } = await searchParams;
  const isTrash = view === "trash";

  const [jobs, trashed, briefs] = await Promise.all([
    listJobsWithStats(),
    listTrashedJobs(),
    listJobBriefs(),
  ]);

  const openRoles = jobs.filter((j) => j.status === "open").length;
  const draftRoles = jobs.filter((j) => j.status === "draft").length;
  const totalApplicants = jobs.reduce((sum, j) => sum + j.applicants, 0);
  const newApplicants = jobs.reduce((sum, j) => sum + j.newApplicants, 0);

  return (
    <div className="space-y-5">
      {!isTrash && jobs.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="duration-500 animate-in fade-in slide-in-from-bottom-2">
            <StatTile label={"Открытые вакансии"} value={openRoles} hint={`${draftRoles} черновик`} icon={Briefcase} />
          </div>
          <div className="delay-75 duration-500 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards">
            <StatTile label={"Отклики"} value={totalApplicants} hint={"по всем вакансиям"} icon={Users} />
          </div>
          <div className="delay-150 duration-500 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards">
            <StatTile label={"Отклики за неделю"} value={newApplicants} hint={"откликов за 7 дней"} icon={TrendingUp} accent />
          </div>
          <div className="delay-200 duration-500 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards">
            <StatTile label={"Всего вакансий"} value={jobs.length} hint={`${draftRoles} не опубликовано`} icon={Briefcase} />
          </div>
        </section>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex w-fit items-center gap-1 rounded-lg border bg-card p-1 text-sm">
          <Tab href="/dashboard/jobs" active={!isTrash}>
            {"Активные "}<span className="ml-1.5 tabular-nums text-muted-foreground">{jobs.length}</span>
          </Tab>
          <Tab href="/dashboard/jobs?view=trash" active={isTrash}>
            <Trash2 className="size-3.5" />
            {"Корзина "}<span className="ml-1.5 tabular-nums text-muted-foreground">{trashed.length}</span>
          </Tab>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/jobs/briefs/new">
            <Plus className="size-4" />
            Создать профиль позиции
          </Link>
        </Button>
      </div>

      {!isTrash && briefs.length > 0 ? (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Брифы до создания вакансии</h2>
          <div className="space-y-2">
            {briefs.map((brief) => <Link key={brief.id} href={`/dashboard/jobs/briefs/${brief.id}`} className="block rounded-lg border px-3 py-2 hover:bg-muted">{brief.title}{brief.jobId ? " · вакансия создана" : " · черновик"}</Link>)}
          </div>
        </section>
      ) : null}

      {isTrash ? (
        trashed.length > 0 ? (
          <Card className="gap-0 divide-y divide-border/60 overflow-hidden py-0">
            {trashed.map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <JobIdentity title={job.title} department={job.department} location={job.location} deletedAt={job.deletedAt} muted />
                <TrashJobActions jobId={job.id} jobTitle={job.title} />
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState
            icon={Trash2}
            title={"Корзина пуста"}
            description={"Здесь появятся задания, которые вы переместили в корзину, и их можно будет восстановить."}
          />
        )
      ) : jobs.length > 0 ? (
        <JobsTable jobs={jobs} />
      ) : (
        <EmptyState
          icon={Briefcase}
          title={"Пока нет вакансий"}
          description={"Создайте первую вакансию. Harly добавит стандартные этапы отбора автоматически."}
          action={{ href: "/dashboard/jobs/new", label: "Создать вакансию" }}
        />
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Briefcase;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        tileClass,
        "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md",
        accent && "border-primary/25 bg-accent/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg transition-colors duration-200",
            accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      className={cn(
        "flex items-center gap-1 rounded-md px-3 py-1.5 font-medium transition",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
