# Desktop Core Simplification Spec

## Added Requirements

### Requirement: Core Desktop Surface

The desktop app shall prioritize Prompt management, Skill management, and
multi-platform Skill distribution as the visible primary product surface.

#### Scenario: User opens the simplified desktop app

- **Given** the user launches the desktop app
- **When** the main shell is displayed
- **Then** the visible primary modules are Prompt and Skill
- **And** Rules, Web self-hosting, CLI management, AI setup, cloud sync, and
  public update flows are not presented as primary workflows.

### Requirement: Mac Packaging Preservation

The simplification shall keep the desktop Electron build path intact.

#### Scenario: Agent completes a simplification milestone

- **Given** a milestone removes or hides non-core features
- **When** verification is performed
- **Then** the desktop build must pass
- **And** final simplification completion must verify `pnpm electron:build:mac`
  can generate macOS package artifacts.

## Modified Requirements

### Requirement: Settings Scope

Desktop settings shall expose only settings that support the retained core
workflows or basic app operation.

#### Scenario: User opens Settings

- **Given** the user opens Settings
- **When** the simplified first stage is active
- **Then** Settings shows General, Appearance, Data, Skill, and About sections
- **And** AI, Security, Shortcuts, CLI, Web workspace, Web devices, and cloud
  sync sections are not visible.

### Requirement: Data Settings Scope

Data settings shall retain local data path, recovery, and manual backup/import
controls while hiding cloud sync providers.

#### Scenario: User opens Data Settings

- **Given** the user opens the Data settings section
- **When** the simplified first stage is active
- **Then** local data, recovery, and backup/import subsections remain available
- **And** WebDAV, S3, and self-hosted PromptHub sync subsections are not shown.

## Removed Requirements

### Requirement: Rules As A Primary Module

Rules management is not part of the user's core simplified app unless the user
later reintroduces it.

#### Scenario: User navigates the simplified desktop app

- **Given** the user is in the main desktop shell
- **When** they inspect the primary navigation
- **Then** the Rules module is not shown.
