"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { trashCandidateAction } from "./actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CandidateActionsMenuProps = {
  candidateId: string;
  /** When true, redirect to the candidates list after deletion. */
  redirectAfterTrash?: boolean;
  align?: "start" | "end";
};

export function CandidateActionsMenu({
  candidateId,
  redirectAfterTrash = false,
  align = "end",
}: CandidateActionsMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function deleteCandidate() {
    startTransition(async () => {
      const result = await trashCandidateAction(candidateId);
      if (!result.success) {
        toast.error(result.error ?? "Не удалось удалить кандидата.");
        return;
      }
      toast.success("Кандидат перемещен в корзину.");
      if (redirectAfterTrash) {
        router.replace("/dashboard/candidates");
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
          aria-label={"Действия кандидата"}
          disabled={isPending}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        <DropdownMenuItem variant="destructive" onClick={deleteCandidate}>
          <Trash2 />
          {"Переместить в корзину "}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
