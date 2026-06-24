# Implementation Documentation

This directory holds implementation-facing documents: phase roadmaps, designs, execution plans, and verification notes.

Implementation docs are lower authority than PRDs and ADRs:

- PRDs define product intent and layer responsibilities.
- ADRs define decisions and contracts that implementations must obey.
- Implementation docs explain how a specific phase will be built and verified.

## Structure

Recommended structure for a substantial phase:

```text
docs/implementation/<phase-or-area>/
  README.md
  00-roadmap.md
  00-acceptance.md
  <step-id>-<short-name>/
    design.md
    plan.md
    verification.md
```

Use `design.md` for architecture and behavior, `plan.md` for task-by-task execution, and `verification.md` for evidence gathered during or after implementation.

Agent-generated drafts under `docs/superpowers/` should be migrated here once the project adopts them.
