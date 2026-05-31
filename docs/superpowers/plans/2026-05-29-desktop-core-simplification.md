# Desktop Core Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the desktop app's visible product surface to Prompt management, Skill management, and multi-platform Skill distribution while preserving macOS packaging.

**Architecture:** Stage 1 is a renderer-surface change: hide non-core navigation/settings while keeping Electron, preload, IPC, and main-process service wiring intact. Later stages can delete unused code after the desktop build proves stable.

**Tech Stack:** Electron 33, React 18, TypeScript 5, Vite 6, Zustand, Tailwind CSS, pnpm workspaces.

---

### Task 1: Create Change Record

**Files:**
- Create: `spec/changes/active/desktop-core-simplification/proposal.md`
- Create: `spec/changes/active/desktop-core-simplification/specs/desktop-core/spec.md`
- Create: `spec/changes/active/desktop-core-simplification/design.md`
- Create: `spec/changes/active/desktop-core-simplification/tasks.md`
- Create: `spec/changes/active/desktop-core-simplification/implementation.md`

- [x] **Step 1: Document the goal**

Write the user's protected core workflows: Prompt management, Skill management,
multi-platform Skill distribution, and macOS `.dmg` packaging.

- [x] **Step 2: Document first-stage scope**

Record that Stage 1 hides non-core UI and does not delete deep backend chains.

### Task 2: Narrow Desktop Home Modules

**Files:**
- Modify: `apps/desktop/src/renderer/stores/settings.store.ts`
- Modify: `apps/desktop/src/renderer/components/layout/Sidebar.tsx`

- [ ] **Step 1: Restrict default desktop modules**

Change the desktop home module list to include only `prompt` and `skill`.

- [ ] **Step 2: Remove Rules from visible navigation**

Remove the fallback branch that creates a Rules rail item for visible modules.

- [ ] **Step 3: Verify with TypeScript/build**

Run `pnpm --filter @prompthub/desktop build`. Expected: build completes.

### Task 3: Narrow Settings UI

**Files:**
- Modify: `apps/desktop/src/renderer/components/settings/SettingsPage.tsx`

- [ ] **Step 1: Keep only core/basic desktop settings**

Keep General, Appearance, Data, Skill, and About in `DESKTOP_SETTINGS_MENU`.

- [ ] **Step 2: Hide cloud sync data subsections**

Keep Data directory, Data recovery, and Backup; hide Self-Hosted PromptHub,
WebDAV, and S3.

- [ ] **Step 3: Remove imports that become unused**

Remove unused icon/component imports after narrowing the menus.

- [ ] **Step 4: Verify with TypeScript/build**

Run `pnpm --filter @prompthub/desktop build`. Expected: build completes.

### Task 4: Record Verification

**Files:**
- Modify: `spec/changes/active/desktop-core-simplification/tasks.md`
- Modify: `spec/changes/active/desktop-core-simplification/implementation.md`

- [ ] **Step 1: Mark completed tasks**

Mark Stage 1 checklist items complete after implementation lands.

- [ ] **Step 2: Record build result**

Write the exact command and outcome in `implementation.md`.
