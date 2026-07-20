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
