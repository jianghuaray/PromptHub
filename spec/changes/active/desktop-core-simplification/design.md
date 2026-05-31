# Design

## Overview

Stage 1 narrows the desktop renderer surface without large backend deletion.
The app keeps the Electron shell, database, Prompt flow, Skill flow, and Skill
platform distribution flow intact. Non-core modules are hidden from navigation
and settings first, which preserves buildability and gives later stages a clean
map of unused code paths to remove.

## Affected Areas

- Data model: no schema changes in stage 1.
- IPC / API: no IPC channel deletion in stage 1.
- Filesystem / sync: no sync implementation deletion in stage 1; cloud sync
  settings are hidden from the UI.
- UI / UX:
  - Restrict desktop home modules to Prompt and Skill.
  - Hide Rules from the primary navigation.
  - Hide AI, Security, Shortcuts, CLI, Web-only, and cloud sync settings.
  - Keep Skill settings because platform distribution configuration is core.
  - Keep Data local/recovery/manual backup sections for safe personal use.
- Packaging: keep `apps/desktop/electron-builder.json`,
  `apps/desktop/vite.config.ts`, and desktop package scripts unchanged.

## Tradeoffs

- Hiding before deleting leaves dead code temporarily but reduces the chance of
  breaking macOS packaging in the first pass.
- Keeping manual backup/import is slightly broader than the stated core, but it
  is useful protection while simplifying a local-first data app.
- Rules is hidden even though it shares platform concepts with Skill
  distribution, because the user named Skill distribution as core and Rules as
  non-core.
