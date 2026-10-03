import { Badge } from "@/components/ui/badge";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const applicationStatusMap: Record<
  string,
  { variant: BadgeVariant; label: string }
> = {
  active: { variant: "success", label: "Активные" },
  hired: { variant: "success", label: "Нанят" },
  rejected: { variant: "danger", label: "Отказ" },
  withdrawn: { variant: "neutral", label: "снято" },
};

const jobStatusMap: Record<string, { variant: BadgeVariant; label: string }> = {
  draft: { variant: "neutral", label: "Черновик" },
  open: { variant: "success", label: "Открыта" },
  closed: { variant: "warning", label: "Закрыта" },
};

export function ApplicationStatusBadge({ status }: { status: string }) {
  const entry = applicationStatusMap[status] ?? {
    variant: "neutral" as const,
    label: status,
  };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export function JobStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const entry = jobStatusMap[status] ?? {
    variant: "neutral" as const,
    label: status,
  };
  return (
    <Badge variant={entry.variant} className={className}>
      {entry.label}
    </Badge>
  );
}
