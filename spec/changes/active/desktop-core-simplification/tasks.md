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
- [x] Stage 3: remove hidden cloud sync renderer services and save-sync
  scheduler while preserving local backup/import.
- [x] Stage 3: remove remaining desktop AI preload/main IPC/service files and
  switch Skill safety checks to static scanning.
- [x] Stage 3: remove `apps/web`, `apps/cli`, and `website` from the local
  simplified checkout.
- [x] Stage 3: keep only Chinese and English renderer locale assets.
- [x] Stage 3: remove advanced Appearance controls for desktop background image
  and animation tuning.
- [x] Stage 3: remove the Skill Store desktop module while keeping local Skill
  management, local scanning, and platform distribution.
- [x] Stage 3: switch macOS packaging to Apple Silicon (`arm64`) only.
- [x] Stage 3: remove now-unused S3/updater dependencies and update the lockfile.
- [x] Verify desktop typecheck/build after Stage 3 cleanup.
- [x] Verify Apple Silicon macOS packaging with `pnpm electron:build:mac`.
