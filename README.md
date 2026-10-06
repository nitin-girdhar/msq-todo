# msq-todo — To-Do / Tasks

Extracted from the `msq-platforms` monorepo per `docs/Phase5_Extraction_Plan.md`
(§2d). Owns: `tasks-service`, `todo-web`, the `@task/*` packages, and the
`task` DB schema.

**Depends on `@platform/*` from `msq-core`** — clone this repo as a
`msq-todo/` subfolder inside `msq-core` (see `msq-core`'s README), which
doubles as the parent pnpm workspace root (D5 Stage 1). Not buildable in
isolation.

## Status — Stage D extraction in progress, known gaps

Same gaps as msq-lms/msq-hrms (see their READMEs for full detail):

1. **Cannot bootstrap a database alone** — `db_scripts/01_init-db.sql` and
   `10_init-hr-task-schemas.sql` are still schema-interleaved with shared and
   hr DDL. Run `msq-core`'s `db_deploy.ps1` first.
2. **Drizzle table-type split not done** — `task.*` table definitions still
   live in `msq-core`'s `packages/db/src/schema/`. A local
   `@task/db-schema` package is a tracked follow-up.
3. **Cross-repo Docker networking not wired.**
4. **Docker image builds need `msq-core`'s root as build context**, not this
   repo alone — e.g. `docker build -f msq-todo/services/tasks-service/Dockerfile .`
   run from `msq-core/`. Verified working this way.
5. **`turbo`/`depcruise`/`lint` need this repo's own `pnpm install`, which
   breaks `@platform/*` resolution** — verify via
   `pnpm --filter "./msq-todo/**" run build|typecheck` from `msq-core`'s root
   instead.

## Local dev (Stage 1 — pnpm workspace, no registry)

```
make install   # run from msq-core's root, not from inside this repo alone
make dev       # requires msq-core's `make dev-infra` + `make dev` already running
```

## Screens and API (Stitch "ToDo" redesign, schema 1.68.0)

The full write-up is in `docs/Architecture.md` → **Tasks (To-Do) — Stitch redesign**; the table/column
reference is `docs/DB_model.md` (`task.tasks.task_no`, `task.task_counters`, `vw_tasks_enriched`).

| Route | What it is |
|---|---|
| `/tasks` | My Tasks: KPI tiles, quick-add, filters, List / Board, bulk bar, Export CSV |
| `/tasks/team` | Team tasks (`tasks.view.team`): same hub, `scope=team` |
| `/tasks/[id]` | Full task page: breadcrumbs, sibling rail, notes + audit tabs |
| `/tasks/lists` | Lists & Scopes (`tasks.lists.view`): who owns / can see each list |

New endpoints: `GET /tasks/stats`, `GET /tasks/export` (`tasks.export`), `POST /tasks/bulk` (`tasks.bulk`);
`GET /tasks` gained `unassigned`, `sla_state`, `sort`, `dir`. Bruno requests are under `api-testing/Tasks/`.

Design notes worth knowing before changing this code:

- A branch **is** an organization, so list visibility stays `private | team | org`; the UI labels `org` as
  **Branch** (tenant brand term). There is no tenant-wide tier.
- Due dates are stored as the **end of the chosen day** in the user's timezone (`dueDateToISO` /
  `isoToDateInput` in `lib/tasks/format.ts`); SLA (`overdue` / `due_soon` / `ok`) is derived from `due_at`
  in the view.
- The table is a plain token-styled `<table>` (no AG Grid dependency): the data is server-paged and
  server-sorted. Not built from the design: timeline, sprints, subtasks, recurrence, attachments, AI Polish.
- Colours are theme tokens only — no hex, no `slate-*`. Dark mode is on (`supportsDark` in
  `app/layout.tsx`), so the user's Light / Dark / System choice is honoured.
