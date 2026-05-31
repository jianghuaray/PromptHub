# Implementation

## Shipped

- Updated `AGENTS.md` with the local simplification goal and protected core
  workflows.
- Created active change records under
  `spec/changes/active/desktop-core-simplification/`.
- Narrowed desktop home modules to Prompt and Skill by changing
  `DESKTOP_HOME_MODULES`.
- Narrowed Settings to General, Appearance, Data, Skill, and About.
- Hid cloud sync data subsections from the Settings sidebar while keeping local
  data path, recovery, and manual backup/import.
- Simplified the top bar create action so Prompt creation opens the manual
  Prompt modal instead of AI/Quick Add.
- Hid the top bar public update notification entry.
- Removed Rules from renderer-level main content routing, top bar search, and
  sidebar panel code.
- 移除了 Prompt 界面里可见的 AI 测试入口，包括右键菜单、表格按钮、看板按钮、
  详情页 AI 测试按钮、多模型对比入口，以及 AI 测试弹窗入口。
- 移除了新增 Skill 界面里的 AI Draft 和 AI Polish 可见入口，保留手动创建、
  Git 仓库导入、本地扫描导入等核心 Skill 工作流。
- `AGENTS.md` 增加了“交接文件尽量用中文”和“面向非技术用户解释”的要求。
- 继续清理了 Prompt 详情页中已经不可达的 AI 测试执行代码，包括流式响应、
  图片生成、多模型对比、AI 结果缓存等状态与函数。
- 继续清理了 Skill 创建弹窗中已经不可达的 AI 草稿/AI 润色执行代码，保留
  手动创建、Git 仓库导入和本地扫描导入。
- 移除了 Settings store 中刷新 Rules 工作区的动态导入，构建产物中不再生成
  `rules.store` chunk。
- Data 设置不再显示 Rules 导出项和规则文件目录；Skill 平台设置不再显示
  Rules 路径配置，继续聚焦 Skill 分发相关路径。
- 移除了桌面 preload 中暴露的 Rules/CLI API，主进程不再注册 Rules/CLI IPC。
- 删除了桌面端孤立的 Rules 管理页、Rules store、CLI 设置页，以及对应的
  Rules/CLI preload API 文件和主进程服务文件。
- 桌面备份导出/导入不再采集或恢复 Rules 数据，保留 Prompt、Skill、版本历史、
  媒体、设置等核心数据。
- 移除了桌面自动更新弹窗、后台检查逻辑、preload updater API，以及主进程
  updater 服务文件。About 设置不再显示更新检查和预览通道配置。
- 禁用了桌面端 WebDAV/S3/自托管同步的启动后自动同步、定时同步、窗口恢复后
  补跑同步，以及保存 Prompt/Folder 后的云同步调度；本地手动备份/导入继续
  保留。
- 移除了桌面端 WebDAV/S3 主进程 IPC 注册、preload 运行时暴露，以及对应的
  主进程服务文件。保留旧类型兼容声明，避免尚未删除的隐藏同步服务代码影响
  编译，但运行时已经没有云同步后端入口。

## Verification

- `pnpm --filter @prompthub/desktop build` passed.
- Initial build attempt failed because local `node_modules` was missing; ran
  `pnpm install`, then reran the desktop build successfully.
- Re-ran `pnpm --filter @prompthub/desktop build` after removing renderer Rules
  entry points; it passed.
- `pnpm --filter @prompthub/desktop typecheck` passed after removing visible
  Prompt AI actions and Skill AI creation/polish actions.
- `pnpm --filter @prompthub/desktop build` passed after the same AI UI cleanup.
- `pnpm --filter @prompthub/desktop typecheck` passed after deleting the
  unreachable Prompt/Skill AI implementation code.
- `pnpm --filter @prompthub/desktop build` passed after deleting the
  unreachable Prompt/Skill AI implementation code.
- `pnpm --filter @prompthub/desktop typecheck` passed after removing the
  remaining visible Rules settings traces.
- `pnpm --filter @prompthub/desktop build` passed after the same Rules cleanup;
  the previous `rules.store` renderer chunk is no longer emitted.
- `pnpm --filter @prompthub/desktop typecheck` passed after removing desktop
  Rules/CLI preload and IPC chains.
- `pnpm --filter @prompthub/desktop build` passed after the same backend cleanup.
- `pnpm --filter @prompthub/desktop typecheck` passed after updater cleanup.
- `pnpm --filter @prompthub/desktop build` passed after updater cleanup. Main
  process bundle dropped to about 271 kB minified in this check.
- `pnpm --filter @prompthub/desktop typecheck` passed after disabling
  background/startup/save cloud sync behavior.
- `pnpm --filter @prompthub/desktop build` passed after disabling
  background/startup/save cloud sync behavior.
- `pnpm --filter @prompthub/desktop typecheck` passed after removing WebDAV/S3
  main/preload runtime channels.
- `pnpm --filter @prompthub/desktop build` passed after deleting unused
  WebDAV/S3 main-process service files. Main process bundle dropped to about
  266 kB minified in this check.
- `pnpm electron:build:mac` passed and generated both macOS installer variants:
  - `apps/desktop/dist/PromptHub-0.5.7-beta.2-arm64.dmg`
  - `apps/desktop/dist/PromptHub-0.5.7-beta.2-x64.dmg`

## Synced Docs

- `AGENTS.md` now documents the local simplification goal and protected core
  workflows.

## Follow-ups

- 下一步优先删除 WebDAV/S3/self-hosted 同步的隐藏设置页和 renderer 服务文件，
  以及 AI 相关的剩余 IPC/服务链路；清理时继续保持桌面构建和 DMG 打包可通过。
