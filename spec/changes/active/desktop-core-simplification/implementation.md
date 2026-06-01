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
- 删除了剩余隐藏云同步 renderer 服务与保存后同步调度，桌面端现在只保留
  本地手动备份/导入恢复。
- 删除了剩余桌面 AI preload/main IPC/service 文件，Skill 安全扫描改为静态
  扫描，不再依赖 AI 配置。
- 删除了 `apps/web`、`apps/cli` 和 `website`，本地简化版只保留桌面应用及
  必要共享包。
- renderer 语言资源只保留简体中文和英文，设置页也只提供这两个语言选项。
- Appearance 设置移除了桌面背景图和动画强度等高级外观控制，保留主题、
  颜色、字号和首页模块排序。
- macOS 打包改为 Apple Silicon (`arm64`) only：`electron:build:mac` 和
  `electron-builder.json` 不再生成 Intel/x64 产物。
- 移除了不再使用的 S3 SDK 和 electron-updater 依赖，并更新了 `pnpm-lock.yaml`。

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
- `pnpm --filter @prompthub/desktop typecheck` passed after Stage 3 cloud/AI/
  locale/appearance/package cleanup.
- `pnpm --filter @prompthub/desktop build` passed after Stage 3 cleanup.
- `pnpm electron:build:mac` passed after switching macOS packaging to Apple
  Silicon only and generated:
  - `apps/desktop/dist/PromptHub-0.5.7-beta.2-arm64.dmg`
  - `apps/desktop/dist/PromptHub-0.5.7-beta.2-arm64.zip`
  The old x64 artifacts were removed before the final packaging run.

## Synced Docs

- `AGENTS.md` now documents the local simplification goal and protected core
  workflows.
- `AGENTS.md` now records that this simplified checkout packages Apple Silicon
  (`arm64`) only and that Web/CLI/website have been removed.

## Follow-ups

- Settings store 和 shared 类型里仍保留一些 AI/cloud/rules 的兼容字段，主要
  是为了兼容旧数据和降低一次性迁移风险；后续可以在单独阶段继续删。
- 旧测试里还有一些针对已移除 Rules/cloud/AI/Web/CLI 工作流的用例；后续如果
  要恢复完整测试套件，需要先修剪这些测试。
