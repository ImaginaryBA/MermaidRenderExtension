# Issue tracker: GitHub

Issues for this repo live in GitHub Issues at
[`ImaginaryBA/MermaidRenderExtension`](https://github.com/ImaginaryBA/MermaidRenderExtension/issues).

## How skills interact with it

Use the `gh` CLI (or an equivalent GitHub integration when `gh` isn't available).

- **Create an issue**: `gh issue create --title "<title>" --body-file <file> [--label <label>]`
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list [--label <label>] [--state open]`
- **Comment**: `gh issue comment <number> --body-file <file>`
- **Edit labels**: `gh issue edit <number> --add-label <label> --remove-label <label>`
- **Close**: `gh issue close <number> --reason "completed"|"not planned" [--comment "<why>"]`

Refer to issues by number (`#123`). When one issue blocks another, write
`Blocked by #<n>` in the body of the blocked issue. Use sub-issues where
the tracker supports them.

## PRs as a request surface

**Off.** Triage handles issues only. Pull requests aren't treated as incoming
requests and aren't pulled into the triage queue.

To include external PRs in triage, change the line above to **On**.
