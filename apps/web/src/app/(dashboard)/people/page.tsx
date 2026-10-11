import { UserRound } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { listPeopleAction } from "@/features/people/actions";
import { PeopleTable, type PersonListRow } from "@/features/people/PeopleTable";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const rows = await listPeopleAction();

  const people: PersonListRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    image: row.image,
    jobTitle: row.jobTitle,
    username: row.username,
    timezone: row.timezone,
    specialties: row.specialties ?? [],
    role: row.role,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{"Люди"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {"Все члены команды, с контактными данными, специальностями и доступностью. "}</p>
      </div>

      {people.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title={"Товарищей по команде пока нет"}
          description={"Пригласите людей из «Настройки» → «Участники», чтобы увидеть их здесь."}
        />
      ) : (
        <PeopleTable rows={people} />
      )}
    </div>
  );
}
