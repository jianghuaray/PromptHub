# Proposal

## Why

The local owner wants to simplify the upstream PromptHub project into a personal
macOS desktop app. The app should focus on Prompt management, Skill management,
and multi-platform Skill distribution while staying packageable as a real
Electron macOS application.

## Scope

- In scope:
  - Keep desktop Prompt management visible and usable.
  - Keep desktop Skill management visible and usable.
  - Keep multi-platform Skill install/distribution flows visible and usable.
  - Hide or remove non-core desktop UI entries in stages.
  - Preserve `pnpm electron:build:mac` as the final packaging path.
- Out of scope for the first stage:
  - Deleting deep IPC/main-process service chains.
  - Removing workspace packages such as `apps/web`, `apps/cli`, or `website`.
  - Changing database schema or user data format.
  - Replacing Electron or electron-builder.

## Risks

- Removing UI before deleting code can leave unused files temporarily, but keeps
  the desktop build safer during staged simplification.
- Some non-core features are tangled with core screens, especially AI actions in
  Prompt/Skill creation and data sync settings.
- Removing Rules must not affect Skill platform distribution because both touch
  AI coding tool platform concepts.

## Rollback Thinking

The first stage should be easy to roll back because it mainly changes visible
UI menus and defaults. If a core workflow disappears, restore the relevant
menu item or module list before continuing deeper deletion.
