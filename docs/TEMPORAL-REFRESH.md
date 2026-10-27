# Local Temporal data refresh

The MCP public-data refresh runs without an LLM in a dedicated local Temporal
service. The frontend remains on GitHub Pages. This service only prepares public
datasets; it does not host the app or store personal collections.

- UI: http://localhost:8333/namespaces/mcp-refresh/workflows
- gRPC: `127.0.0.1:7333`, namespace `mcp-refresh`
- Schedule: `mcp-data-daily`, daily **10:00 Europe/Amsterdam**, DST-aware
- Cutoff: the previous calendar day in Amsterdam, saved once in `job.json`
- Overlap: `SKIP`; a run awaiting review also blocks the next scheduled run
- Catch-up: 12 hours; missed older starts are discarded
- Persistent server database: `../../mcp-character-lab/temporal-runtime/temporal.db`
- Raw data and stage logs: `../../mcp-character-lab/refresh-runs/temporal-<run-id>/`

The server and worker are macOS user LaunchAgents and start at login, with restart
on process failure. They require the laptop to be running and the user logged in.
Sleeping the laptop pauses local work. This is a loopback-only personal dev server
with SQLite persistence, not a public production Temporal deployment. Keep its DB
and the raw run directories together when backing up or moving machines.

## Operator commands

Run from the repository root. The runtime Python has the pinned SDK installed:

```sh
MCP_REFRESH_PY=/Users/aslanator/new_projects/painting/mcp-character-lab/temporal-runtime/.venv/bin/python
"$MCP_REFRESH_PY" tools/data-refresh/control.py schedule-status
"$MCP_REFRESH_PY" tools/data-refresh/control.py pause
"$MCP_REFRESH_PY" tools/data-refresh/control.py unpause
"$MCP_REFRESH_PY" tools/data-refresh/control.py trigger
```

`trigger` uses the schedule's overlap policy. `schedule` creates or reconciles the
10:00 definition, preserving any existing operator pause. Do not create a second
Codex heartbeat or cron job for this same work.

For an explicit historical cutoff or to adopt an existing runner checkpoint:

```sh
"$MCP_REFRESH_PY" tools/data-refresh/control.py start --end 2026-10-27
"$MCP_REFRESH_PY" tools/data-refresh/control.py start --run-dir /absolute/existing-run
"$MCP_REFRESH_PY" tools/data-refresh/control.py status --workflow-id WORKFLOW_ID
```

## Stages, errors and publication

The workflow executes separate Activities for capture, apply, roles, references,
scrape, countries, prepare, validate, rating, build, Node tests and browser tests.
Each Activity calls the same checked-in `refresh.py` runner used by the manual
mode. Heavy commands and raw output stay in stage logs. Heartbeats report compact
progress every ten seconds; Temporal history contains no roster dataset blobs.

An Activity retried after worker loss waits for any surviving locked driver. It
reloads the checkpoint after obtaining the lock and skips a completed stage.
The repository lock serializes stage processes, and an active-run lease prevents
another job or manual runner from interleaving while review is pending. A worker
restart therefore does not force a fresh scrape. Source requests retain their
20-second pacing and bounded cached network retries.

Validation/parser/role/layout failures enter `needs_attention` and wait for a
resume signal. Fix only the relevant problem, then continue the same workflow:

```sh
"$MCP_REFRESH_PY" tools/data-refresh/control.py resume --workflow-id WORKFLOW_ID
"$MCP_REFRESH_PY" tools/data-refresh/control.py resume --workflow-id WORKFLOW_ID --from-stage tests
```

The second form invalidates only that stage and later checkpoints. Stages before
it are retained. Do not launch a separate job just to recover a failed test.

A successful preparation enters `ready_to_publish`. Review the semantic diff,
commit only refresh-related changes, push, and confirm Pages deployed the exact
commit. Then complete the waiting workflow:

```sh
"$MCP_REFRESH_PY" tools/data-refresh/control.py published --workflow-id WORKFLOW_ID --commit FULL40SHA
```

Finalization validates the commit's cutoff and source snapshot, checks live bytes
for index/catalog/tournament data, and only then advances `update_state.json` and
releases the active-run lease. A stale or undeployed commit leaves the workflow
waiting for a corrected `published` signal. The schedule never commits or pushes
unchecked new rules, role assignments, or generated data.

If a workflow is deliberately abandoned, terminate it through Temporal, wait for
its driver/children to finish, preserve or revert its scoped repo changes, and
release its lease only under the same repo lock. Do not delete the lease to start
a competing job while a stage still runs.

## Reinstall / diagnostics

Requirements: Temporal CLI, Python 3.10+, Node/npm, existing app dependencies,
Playwright browser, and `../../longshanks_scraper/.venv` plus its source scripts.
The worker inherits the installing user's PATH so Node and the scraper are found.

```sh
python3 -m venv ../../mcp-character-lab/temporal-runtime/.venv
../../mcp-character-lab/temporal-runtime/.venv/bin/pip install -r tools/data-refresh/requirements.txt
python3 tools/data-refresh/install-services.py
"$MCP_REFRESH_PY" tools/data-refresh/control.py schedule
```

LaunchAgent labels:
`org.mcp-companion.temporal-server`, `org.mcp-companion.temporal-worker`.
Their plists live under `~/Library/LaunchAgents/`; service logs live under
`../../mcp-character-lab/temporal-runtime/logs/`.

```sh
temporal --address 127.0.0.1:7333 operator cluster health
launchctl print "gui/$(id -u)/org.mcp-companion.temporal-worker"
"$MCP_REFRESH_PY" -m unittest discover -s tools/data-refresh -p 'test_*.py'
```

Integration tests use the local service with unique fixture workflow IDs/queues.
They test a failed stage, resume, worker restart, rejected publication and a
successful publication signal without collecting public sources. Separate driver
tests verify concurrent duplicate delivery only performs a stage once.

Official references: [local CLI service](https://docs.temporal.io/cli),
[Python schedules](https://docs.temporal.io/develop/python/workflows/schedules),
[Activity idempotence and retries](https://docs.temporal.io/develop/python/best-practices/error-handling).
