# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in `Welbert-Soares/nexis`. Use the **GitHub MCP server** (`mcp__plugin_github_github__*` tools) for all operations — the `gh` CLI is not installed on this machine. Auth comes from `GITHUB_PERSONAL_ACCESS_TOKEN` in `.claude/settings.local.json` (gitignored).

Every tool below takes `owner` and `repo` — pass `Welbert-Soares` / `nexis` (infer from `git remote -v` if working in a fork or clone under another owner).

## Conventions

- **Create an issue**: `issue_write` with `method: "create"`, `title`, `body` (Markdown, multi-line is fine), optional `labels` / `assignees`.
- **Read an issue**: `issue_read` with `method: "get"` for the body/metadata, then `method: "get_comments"` for the thread and `method: "get_labels"` for labels.
- **List issues**: `list_issues` with `state` (`OPEN` / `CLOSED`), `labels`, `orderBy` + `direction`. Narrow the payload with `fields: ["number","title","body","labels","comments"]`; paginate with `perPage` + `after` (cursor from `pageInfo.endCursor`).
- **Search issues**: `search_issues` with a query string (e.g. `repo:Welbert-Soares/nexis is:open label:needs-triage`) for text or complex filters; use `sort` / `order` params, never `sort:` syntax inside the query.
- **Comment on an issue**: `add_issue_comment` with `issue_number` and `body`.
- **Apply / remove labels**: `issue_write` with `method: "update"`, `issue_number`, and the full `labels` array you want the issue to end up with (it replaces, not merges — read current labels first if you're only adding one).
- **Close**: `issue_write` with `method: "update"`, `state: "closed"`, and `state_reason` (`completed` / `not_planned` / `duplicate`). Add the closing rationale as a separate `add_issue_comment` call.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the PR-flavoured tools:

- **Read a PR**: `pull_request_read` with `method: "get"` (metadata), `method: "get_comments"` (discussion), `method: "get_diff"` (the diff).
- **List external PRs for triage**: `list_pull_requests` with `state: "open"` (add `fields` to trim payload), then keep only PRs whose author is an outside contributor — cross-check with `list_repository_collaborators` and drop anyone who appears there.
- **Comment / label / close**: `add_issue_comment` (pass the PR number as `issue_number`), `issue_write` with `method: "update"` for `labels` and `state` (again, PR number as `issue_number`).

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: try `pull_request_read` with `method: "get"` and fall back to `issue_read` with `method: "get"`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue (`issue_write`, `method: "create"`).

## When a skill says "fetch the relevant ticket"

`issue_read` with `method: "get"` then `method: "get_comments"`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `issue_write` with `method: "create"`, `labels: ["wayfinder:map"]`.
- **Child ticket**: create with `issue_write` `method: "create"` and `parent_issue_number: <map>` so it is attached as a native GitHub sub-issue in one call (or attach an existing issue with `sub_issue_write` `method: "add"`, passing the child's **id**, not its number). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: the GitHub MCP server has **no tool for native issue dependencies**, so use the body-line convention: a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every issue listed there is closed (check with `issue_read` `method: "get"` on each).
- **Frontier query**: list the map's open children (`issue_read` `method: "get_sub_issues"` on the map, or the map's task list), drop any with an unclosed issue in its `Blocked by` line or with an assignee; first in map order wins.
- **Claim**: `issue_write` with `method: "update"`, `assignees: ["<username>"]` — the session's first write.
- **Resolve**: `add_issue_comment` with the answer, then `issue_write` `method: "update"` `state: "closed"`, then append a context pointer (gist + link) to the map's Decisions-so-far.
