/**
 * Permission catalog , the single source of truth for what actions exist and
 * which roles may perform them. Client-safe (no server imports) so both the
 * enforcement layer and the UI matrix read from the same list.
 *
 * A permission key is `resource:action`. Roles (built-in or custom) own a set
 * of these keys. `owner` is unconditionally all-powerful; `admin` receives the
 * full explicit permission set (see `roleIsAllPowerful`).
 */

export const PERMISSIONS = [
  "jobs:create",
  "jobs:view",
  "jobs:edit",
  "jobs:delete",
  "jobs:publish",
  "jobs:approve",
  "hiring_team:manage",
  "candidates:view",
  "candidates:edit",
  "candidates:delete",
  "candidates:move",
  "dsar:manage",
  "collab:write", // notes, scorecards, schedule interviews, message
  "interviews:manage",
  "interviews:feedback",
  "tasks:read",
  "tasks:write",
  "offers:manage",
  "offers:approve",
  "templates:manage",
  "reports:read",
  "members:read",
  "members:invite",
  "members:edit",
  "members:remove",
  "invite_links:manage",
  "settings:edit",
  "integrations:manage",
  "roles:manage",
  "security:manage",
  "documents:read",
  "documents:manage",
  "documents:share",
  "automations:manage", // create / edit / toggle / delete workflows
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Tenant-local constraints layered on top of a role's permissions. Keeping
 * this separate from the permission key prevents a role matrix from exploding
 * into combinations such as `jobs:view:engineering:emea`.
 */
export type RoleScope = {
  jobAccess: "all" | "assigned";
  departments: string[];
  regions: string[];
};

export const unrestrictedRoleScope = (): RoleScope => ({
  jobAccess: "all",
  departments: [],
  regions: [],
});

export function normalizeRoleScope(raw: unknown): RoleScope {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return unrestrictedRoleScope();
  }

  const value = raw as Record<string, unknown>;
  const normalizeList = (input: unknown) =>
    Array.isArray(input)
      ? [...new Set(input.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))]
      : [];

  return {
    jobAccess: value.jobAccess === "assigned" ? "assigned" : "all",
    departments: normalizeList(value.departments),
    regions: normalizeList(value.regions),
  };
}

/** True when the target role would expose more tenant resources than the actor. */
export function scopeExceedsPrivilege(actor: RoleScope, target: RoleScope) {
  if (actor.jobAccess === "assigned" && target.jobAccess === "all") return true;
  const subset = (held: string[], requested: string[]) =>
    held.length > 0 &&
    (requested.length === 0 ||
      requested.some(
        (value) =>
          !held.some(
            (candidate) =>
              candidate.toLocaleLowerCase() === value.toLocaleLowerCase(),
          ),
      ));
  return (
    subset(actor.departments, target.departments) ||
    subset(actor.regions, target.regions)
  );
}

/** True when the target role has strictly less effective access than the actor. */
export function rolePolicyIsStrictlyBelow(
  actor: { permissions: readonly string[]; scope: RoleScope },
  target: { permissions: readonly string[]; scope: RoleScope },
): boolean {
  if (exceedsPrivilege(actor.permissions, target.permissions)) return false;
  if (scopeExceedsPrivilege(actor.scope, target.scope)) return false;

  const permissionsAreStrictlyNarrower = actor.permissions.some(
    (permission) => !target.permissions.includes(permission),
  );
  const scopeIsStrictlyNarrower = scopeExceedsPrivilege(
    target.scope,
    actor.scope,
  );

  return permissionsAreStrictlyNarrower || scopeIsStrictlyNarrower;
}

export type PermissionGroup = {
  label: string;
  permissions: { key: Permission; label: string; hint?: string }[];
};

/** Grouped for the role-editor matrix. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Вакансии",
    permissions: [
      { key: "jobs:create", label: "Создавать вакансии" },
      { key: "jobs:view", label: "Просматривать вакансии" },
      { key: "jobs:edit", label: "Редактировать вакансии" },
      { key: "jobs:delete", label: "Удалять вакансии", hint: "Перемещать вакансии в корзину" },
      { key: "jobs:publish", label: "Публиковать вакансии" },
      {
        key: "jobs:approve",
        label: "Утверждать вакансии",
        hint: "Утверждать вакансии перед началом найма",
      },
      { key: "hiring_team:manage", label: "Управлять командами найма" },
    ],
  },
  {
    label: "Кандидаты",
    permissions: [
      { key: "candidates:edit", label: "Редактировать кандидатов" },
      { key: "candidates:view", label: "Просматривать кандидатов" },
      { key: "candidates:delete", label: "Удалять кандидатов и отклонять отклики" },
      { key: "candidates:move", label: "Перемещать по этапам найма" },
    ],
  },
  {
    label: "Конфиденциальность",
    permissions: [
      {
        key: "dsar:manage",
        label: "Рассматривать запросы на обработку данных",
        hint: "Разрешать или отклонять экспорт и удаление данных кандидатов",
      },
    ],
  },
  {
    label: "Совместная работа",
    permissions: [
      {
        key: "collab:write",
        label: "Заметки, оценки и планирование",
        hint: "Добавлять заметки и оценки, назначать собеседования, писать кандидатам",
      },
      { key: "interviews:manage", label: "Управлять собеседованиями" },
      { key: "interviews:feedback", label: "Оставлять отзывы о собеседованиях" },
      {
        key: "tasks:read",
        label: "Просматривать задачи",
      },
      {
        key: "tasks:write",
        label: "Создавать задачи и управлять ими",
        hint: "Создавать, редактировать, назначать, завершать и архивировать задачи",
      },
      {
        key: "offers:manage",
        label: "Управлять предложениями о работе",
        hint: "Создавать, отправлять и рассматривать предложения о работе",
      },
      { key: "offers:approve", label: "Утверждать предложения" },
      {
        key: "templates:manage",
        label: "Управлять шаблонами писем",
      },
    ],
  },
  {
    label: "Документы",
    permissions: [
      { key: "documents:read", label: "Просматривать документы" },
      { key: "documents:manage", label: "Загружать документы и управлять ими" },
      {
        key: "documents:share",
        label: "Предоставлять доступ к документам",
        hint: "Настраивать доступ к документам и ограничения для участников",
      },
    ],
  },
  {
    label: "Аналитика",
    permissions: [
      {
        key: "reports:read",
        label: "Просматривать отчёты",
        hint: "Просматривать показатели найма, воронки, источники и динамику",
      },
    ],
  },
  {
    label: "Автоматизация",
    permissions: [
      {
        key: "automations:manage",
        label: "Управлять автоматизацией",
        hint: "Создавать, редактировать, включать и удалять процессы найма",
      },
    ],
  },
  {
    label: "Администрирование",
    permissions: [
      { key: "members:read", label: "Просматривать участников и приглашения" },
      {
        key: "members:invite",
        label: "Приглашать участников",
        hint: "Отправлять и отменять приглашения, добавлять существующих пользователей",
      },
      { key: "members:edit", label: "Изменять роли участников" },
      { key: "members:remove", label: "Удалять участников" },
      { key: "invite_links:manage", label: "Управлять ссылками приглашения" },
      { key: "settings:edit", label: "Настраивать рабочее пространство" },
      { key: "integrations:manage", label: "Управлять интеграциями" },
      { key: "roles:manage", label: "Управлять ролями и правами" },
      {
        key: "security:manage",
        label: "Управлять безопасностью",
        hint: "Обязательная двухфакторная аутентификация, единый вход и настройки безопасности",
      },
    ],
  },
];

export const PERMISSION_LABELS: Record<Permission, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.key, p.label])),
) as Record<Permission, string>;

/** Built-in role keys (cannot be deleted; only `owner` is unconditionally all-powerful , `admin` gets the full explicit permission set). */
export const BUILTIN_ROLES = [
  "owner",
  "admin",
  "recruiter",
  "hiring_manager",
] as const;
export type BuiltinRole = (typeof BUILTIN_ROLES)[number];

/** Default permission sets for built-in roles. */
export const BUILTIN_ROLE_PERMISSIONS: Record<BuiltinRole, Permission[]> = {
  owner: [...PERMISSIONS],
  admin: [...PERMISSIONS],
  recruiter: [
    "jobs:create",
    "jobs:view",
    "jobs:edit",
    "jobs:publish",
    "hiring_team:manage",
    "candidates:view",
    "candidates:edit",
    "candidates:move",
    "collab:write",
    "interviews:manage",
    "interviews:feedback",
    "tasks:read",
    "tasks:write",
    "offers:manage",
    "templates:manage",
    "reports:read",
    "members:read",
    "dsar:manage",
    "documents:read",
    "documents:manage",
    "documents:share",
    "automations:manage",
  ],
  hiring_manager: [
    "jobs:view",
    "jobs:edit",
    "jobs:approve",
    "candidates:view",
    "candidates:move",
    "collab:write",
    "interviews:feedback",
    "tasks:read",
    "tasks:write",
    "members:read",
    "reports:read",
    "documents:read",
  ],
};

export function isBuiltinRole(role: string): role is BuiltinRole {
  return (BUILTIN_ROLES as readonly string[]).includes(role);
}

/**
 * Only the owner is unconditionally all-powerful and non-editable , the single
 * keyholder who can never be locked out. Every other role (admin included) runs
 * on its explicit permission set, so it can be tuned.
 */
export function roleIsAllPowerful(role: string): boolean {
  return role === "owner";
}

export function hasPermission(
  permissions: readonly string[],
  key: Permission,
): boolean {
  return permissions.includes(key);
}

/**
 * Privilege-ceiling check: true when `granted` contains any permission the
 * `actor` doesn't already hold , i.e. granting it would be an escalation.
 * The single source of truth used by every server guard that assigns a role
 * or edits a role's permission set. Client-safe and pure so it's unit-testable.
 */
export function exceedsPrivilege(
  actor: readonly string[],
  granted: readonly string[],
): boolean {
  const held = new Set(actor);
  return granted.some((p) => !held.has(p));
}

const builtinRoleLabels: Record<string, string> = {
  owner: "Владелец", admin: "Администратор", recruiter: "Рекрутер",
  hiring_manager: "Руководитель найма",
};

export function roleLabel(role: string): string {
  if (Object.hasOwn(builtinRoleLabels, role)) return builtinRoleLabels[role];
  return role.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Which permission gates each settings section. Single source of truth shared
 * by the nav (to hide what you can't open) and each page (to redirect direct
 * URL access). Sections not listed here are open to any member.
 */
export const SETTINGS_SECTION_PERMISSION: Record<
  string,
  Permission | Permission[]
> = {
  "/settings": "settings:edit",
  "/settings/members": "members:read",
  "/settings/roles": "roles:manage",
  "/settings/ai": "settings:edit",
  "/settings/email": "settings:edit",
  "/settings/integrations": "integrations:manage",
  "/settings/developers": "integrations:manage",
  "/settings/security": "security:manage",
  "/settings/legal": ["settings:edit", "dsar:manage"],
  "/settings/portal": "settings:edit",
  "/settings/signature": "settings:edit",
};
