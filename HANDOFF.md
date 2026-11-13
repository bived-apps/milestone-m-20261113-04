# Handoff

## Goal

Resolve the assigned milestone using the role boundaries in `AGENTS.md`.

## Running it

- Node 22 or newer; Git and GitHub CLI authenticated for this repository.
- The primary OpenCode agent is `supervisor`, with `.bive/prompts/SUPERVISOR.md` as its system prompt.
- Read `ROADMAP.md` and the repository's issues and pull requests for the current assignment.
- No registry participation, external services, private data, or background workers are configured.

## Decisions

- **Owner-approved coordinator teams (owner, 2026-11-13)**: prefer the strongest suitable verified-free usable
  coordinator; otherwise recommend a suitable usable coordinator from the current supervisor provider. Before launch
  or substitution, ask the owner to approve the concrete team, cost, availability evidence, alternatives, and fallback,
  then stop and wait. No silent coordinator substitution or inference that unknown pricing is free. Existing
  qualifications, allow-lists, delegate fallback, and role rights remain unchanged. See `docs/PROVIDERS.md` and the
  supervisor's project additions.
- The supervisor alone merges or closes pull requests, using merge commits. Coordinators review and hand over; delegates implement their assigned issues.

## Tasks

Await the owner's milestone assignment.
