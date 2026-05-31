# Tasks

- [x] Capture the local simplification goal in `AGENTS.md`.
- [x] Create active change records for desktop core simplification.
- [x] Stage 1: narrow visible desktop modules to Prompt and Skill.
- [x] Stage 1: narrow Settings to core/basic sections.
- [x] Stage 1: hide cloud sync subsections from Data settings.
- [x] Stage 1: remove first-run/background UI triggers for hidden non-core
  workflows where they are visible to the user.
- [x] Verify desktop build still succeeds.
- [x] Update `implementation.md` with shipped changes and verification.
- [x] Stage 2: remove Rules from renderer navigation/search/main-content entry.
- [x] Stage 2: remove remaining Rules store/settings import trigger and visible
  settings traces.
- [x] Stage 2: remove deeper AI test/generation actions from Prompt and Skill
  screens.
- [x] Stage 2: delete now-unreachable AI Prompt/Skill implementation code after
  one more focused pass.
- [x] Verify desktop build after unreachable AI implementation cleanup.
- [x] Stage 2: remove desktop Rules/CLI preload APIs, IPC registration, and
  orphan renderer settings/store files.
- [x] Verify desktop typecheck/build after Rules/CLI backend cleanup.
- [x] Stage 2: remove desktop auto-update dialog, preload API, and main-process
  updater service.
- [x] Verify desktop typecheck/build after updater cleanup.
- [x] Stage 2: disable background/startup/save cloud sync behavior in the
  desktop renderer while preserving local backup/import.
- [x] Verify desktop typecheck/build after background sync cleanup.
- [x] Stage 2: remove WebDAV/S3 main-process IPC registration, preload runtime
  exposure, and unused main-process service files.
- [x] Verify desktop typecheck/build after WebDAV/S3 backend cleanup.
- [x] Verify macOS packaging with `pnpm electron:build:mac`.
- [ ] Plan Stage 3 deletion of unused workspace packages after desktop remains
  buildable.
