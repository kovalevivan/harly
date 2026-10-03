"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ExternalLink,
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { restoreJobAction, trashJobAction } from "./actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type JobActionsMenuProps = {
  jobId: string;
  slug: string;
  /** When true, redirect to the jobs list after trashing (used on the detail page). */
  redirectAfterTrash?: boolean;
  align?: "start" | "end";
};

export function JobActionsMenu({
  jobId,
  slug,
  redirectAfterTrash = false,
  align = "end",
}: JobActionsMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function publicUrl() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/jobs/${slug}`;
  }

  function copyLink() {
    void navigator.clipboard.writeText(publicUrl());
    toast.success("Публичная ссылка скопирована.");
  }

  function moveToTrash() {
    startTransition(async () => {
      const result = await trashJobAction(jobId);
      if (!result.success) {
        toast.error(result.error ?? "Не удалось переместить задание в корзину.");
        return;
      }
      toast.success("Работа перемещена в корзину.", {
        action: {
          label: "Отменить",
          onClick: () => {
            startTransition(async () => {
              await restoreJobAction(jobId);
              router.refresh();
            });
          },
        },
      });
      if (redirectAfterTrash) {
        router.replace("/dashboard/jobs");
      }
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground data-[state=open]:bg-accent"
          aria-label={"Действия с вакансией"}
          disabled={isPending}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        <DropdownMenuItem
          onClick={() => router.push(`/dashboard/jobs/${jobId}`)}
        >
          <Pencil />
          {"Редактировать "}</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/jobs/${slug}`} target="_blank" rel="noreferrer">
            <ExternalLink />
            {"Посмотреть общедоступную страницу "}</a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink}>
          <Link2 />
          {"Копировать ссылку "}</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/dashboard/jobs/${jobId}/headhunter-demo`}>
            <Users />
            HeadHunter · демо
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={moveToTrash}>
          <Trash2 />
          {"Переместить в корзину "}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
