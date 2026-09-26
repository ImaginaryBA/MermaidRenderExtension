# Triage labels

The `triage` skill moves issues through five canonical roles. This repo uses the
default label strings. Each label has the same name as its role.

| Role              | Label             | Meaning                                                        |
| ----------------- | ----------------- | -------------------------------------------------------------- |
| `needs-triage`    | `needs-triage`    | New; not yet categorised or verified.                          |
| `needs-info`      | `needs-info`      | Blocked waiting on more information from the reporter.         |
| `ready-for-agent` | `ready-for-agent` | Has an agent-ready brief; an agent can pick it up.             |
| `ready-for-human` | `ready-for-human` | Actionable, but needs human judgement or access to implement.  |
| `wontfix`         | `wontfix`         | Deliberately not being done; close with a reason.              |

If a label doesn't exist on the tracker yet, create it before applying it
(for example, `gh label create ready-for-agent`).
