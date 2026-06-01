import {
  SearchIcon,
  PanelLeftIcon,
  PlusIcon,
  FolderPlusIcon,
  SunIcon,
  MoonIcon,
  XIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  GlobeIcon,
  LogOutIcon,
} from "lucide-react";
import { usePromptStore } from "../../stores/prompt.store";
import { useSettingsStore } from "../../stores/settings.store";
import { useFolderStore } from "../../stores/folder.store";
import { useSkillStore } from "../../stores/skill.store";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useDeferredValue,
  lazy,
  Suspense,
} from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";
import { collectPrivateFolderScopeIds } from "../../services/prompt-filter";
import {
  filterVisibleScannedSkills,
  filterVisibleSkills,
} from "../../services/skill-filter";
import {
  isWebRuntime,
  logoutWebSession,
} from "../../runtime";

const CreatePromptModal = lazy(() =>
  import("../prompt/CreatePromptModal").then((module) => ({
    default: module.CreatePromptModal,
  })),
);
const CreateSkillModal = lazy(() =>
  import("../skill/CreateSkillModal").then((module) => ({
    default: module.CreateSkillModal,
  })),
);

const OPEN_CREATE_SKILL_PROJECT_MODAL_EVENT = "open-create-skill-project-modal";

interface TopBarProps {
  onOpenSettings: () => void;
}

export function TopBar(_props: TopBarProps) {
  const { t } = useTranslation();
  // Prompt store
  const promptSearchQuery = usePromptStore((state) => state.searchQuery);
  const setPromptSearchQuery = usePromptStore((state) => state.setSearchQuery);
  const prompts = usePromptStore((state) => state.prompts);
  const selectPrompt = usePromptStore((state) => state.selectPrompt);
  const createPrompt = usePromptStore((state) => state.createPrompt);

  // Skill store
  const skillSearchQuery = useSkillStore((state) => state.searchQuery);
  const setSkillSearchQuery = useSkillStore((state) => state.setSearchQuery);
  const skills = useSkillStore((state) => state.skills);
  const skillFilterType = useSkillStore((state) => state.filterType);
  const skillFilterTags = useSkillStore((state) => state.filterTags);
  const deployedSkillNames = useSkillStore((state) => state.deployedSkillNames);
  const skillStoreView = useSkillStore((state) => state.storeView);
  const selectedProjectId = useSkillStore((state) => state.selectedProjectId);
  const projectScanState = useSkillStore((state) => state.projectScanState);
  const selectSkill = useSkillStore((state) => state.selectSkill);

  const isDarkMode = useSettingsStore((state) => state.isDarkMode);
  const setDarkMode = useSettingsStore((state) => state.setDarkMode);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const folders = useFolderStore((state) => state.folders);
  const promptTypeFilter = usePromptStore((state) => state.promptTypeFilter);
  const appModule = useUIStore((state) => state.appModule);
  const isSidebarCollapsed = useUIStore((state) => state.isSidebarCollapsed);
  const setSidebarCollapsed = useUIStore((state) => state.setSidebarCollapsed);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateSkillModalOpen, setIsCreateSkillModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const webRuntime = isWebRuntime();
  const isProjectSkillView =
    appModule === "skill" && skillStoreView === "projects";
  const isSkillView = appModule === "skill";
  const isPromptView = appModule === "prompt";

  // Unified search query based on mode
  const searchQuery = isSkillView
    ? skillSearchQuery
    : isPromptView
      ? promptSearchQuery
      : "";
  const deferredSkillSearchQuery = useDeferredValue(skillSearchQuery);
  const setSearchQuery = isSkillView
    ? setSkillSearchQuery
    : isPromptView
      ? setPromptSearchQuery
      : () => undefined;

  // 计算 Prompt 搜索结果（与 MainContent 保持一致的逻辑）
  const promptSearchResults = useMemo(() => {
    if (!isPromptView || !promptSearchQuery.trim()) return [];

    const queryLower = promptSearchQuery.toLowerCase();
    const queryCompact = queryLower.replace(/\s+/g, "");
    const keywords = queryLower.split(/\s+/).filter((k) => k.length > 0);

    let filtered = prompts;

    // 如果在特定文件夹中，只搜索该文件夹
    if (selectedFolderId === "favorites") {
      filtered = filtered.filter((p) => p.isFavorite);
    } else if (selectedFolderId) {
      filtered = filtered.filter((p) => p.folderId === selectedFolderId);
    } else {
      const privateFolderIds = collectPrivateFolderScopeIds(folders);
      if (privateFolderIds.size > 0) {
        filtered = filtered.filter(
          (p) => !p.folderId || !privateFolderIds.has(p.folderId),
        );
      }
    }

    const isSubsequence = (needle: string, haystack: string) => {
      if (!needle) return true;
      if (needle.length > haystack.length) return false;
      let i = 0;
      for (let j = 0; j < haystack.length && i < needle.length; j++) {
        if (haystack[j] === needle[i]) i++;
      }
      return i === needle.length;
    };

    // 使用与 MainContent 相同的评分逻辑
    return filtered
      .map((p) => {
        let score = 0;
        const titleLower = p.title.toLowerCase();
        const descLower = (p.description || "").toLowerCase();

        // 标题精确匹配
        if (titleLower === queryLower) score += 100;
        // 标题包含查询
        else if (titleLower.includes(queryLower)) score += 50;
        // 子序列匹配
        else if (
          queryCompact.length >= 2 &&
          isSubsequence(queryCompact, titleLower.replace(/\s+/g, ""))
        )
          score += 30;

        // 描述包含查询
        if (descLower.includes(queryLower)) score += 20;

        // 所有关键词匹配
        const searchableText = [
          p.title,
          p.description || "",
          p.userPrompt,
          p.userPromptEn || "",
          p.systemPrompt || "",
          p.systemPromptEn || "",
        ]
          .join(" ")
          .toLowerCase();

        if (keywords.every((k) => searchableText.includes(k))) {
          score += 10;
        }

        return { prompt: p, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.prompt);
  }, [folders, isPromptView, promptSearchQuery, prompts, selectedFolderId]);

  // 计算 Skill 搜索结果
  const skillSearchResults = useMemo(() => {
    if (!isSkillView) return [];

    return filterVisibleSkills({
      deployedSkillNames,
      filterTags: skillFilterTags,
      filterType: skillFilterType,
      searchQuery: deferredSkillSearchQuery,
      skills,
      storeView: skillStoreView,
    });
  }, [
    deferredSkillSearchQuery,
    deployedSkillNames,
    skillFilterTags,
    skillFilterType,
    skillStoreView,
    skills,
    isSkillView,
  ]);

  const projectSearchResults = useMemo(() => {
    if (!isProjectSkillView) return [];

    const scannedSkills = selectedProjectId
      ? projectScanState[selectedProjectId]?.scannedSkills || []
      : [];

    return filterVisibleScannedSkills(scannedSkills, deferredSkillSearchQuery);
  }, [
    deferredSkillSearchQuery,
    isProjectSkillView,
    projectScanState,
    selectedProjectId,
  ]);

  // 根据模式选择搜索结果
  const searchResults =
    isSkillView
        ? isProjectSkillView
          ? projectSearchResults
          : skillSearchResults
      : promptSearchResults;
  const searchResultCount = searchResults.length;
  const showSearchNavigation = !isSkillView && !isProjectSkillView;

  // 导航到上一个/下一个结果
  const navigateResult = useCallback(
    (direction: "prev" | "next") => {
      if (searchResultCount === 0) return;

      let newIndex = currentResultIndex;
      if (direction === "next") {
        newIndex = (currentResultIndex + 1) % searchResultCount;
      } else {
        newIndex =
          (currentResultIndex - 1 + searchResultCount) % searchResultCount;
      }
      setCurrentResultIndex(newIndex);

      if (isSkillView) {
        if (isProjectSkillView) {
          return;
        }
        const skillResults = skillSearchResults;
        if (skillResults[newIndex]) {
          selectSkill(skillResults[newIndex].id);
        }
      } else {
        const promptResults = promptSearchResults;
        if (promptResults[newIndex]) {
          selectPrompt(promptResults[newIndex].id);
        }
      }
    },
    [
      searchResultCount,
      currentResultIndex,
      isProjectSkillView,
      isSkillView,
      selectPrompt,
      selectSkill,
      skillSearchResults,
      promptSearchResults,
    ],
  );

  // 当搜索查询变化时重置索引。
  // Prompt 继续自动定位首个结果，Skills 只更新结果计数，不强制改选中项。
  useEffect(() => {
    setCurrentResultIndex(0);
    if (searchQuery.trim().length === 0) {
      return;
    }

    if (isSkillView) {
      return;
    }

    if (promptSearchResults.length > 0) {
      selectPrompt(promptSearchResults[0].id);
    }
  }, [
    isSkillView,
    promptSearchResults,
    searchQuery,
    selectPrompt,
  ]);

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" && searchQuery && searchResultCount > 0) {
      if (!showSearchNavigation) {
        return;
      }
      e.preventDefault();
      navigateResult(e.shiftKey ? "prev" : "next");
    } else if (e.key === "Escape") {
      setSearchQuery("");
      searchInputRef.current?.blur();
    } else if (e.key === "Enter" && searchResultCount > 0) {
      if (isSkillView) {
        e.preventDefault();
        return;
      }
      if (isProjectSkillView) {
        searchInputRef.current?.blur();
        return;
      }
      // Enter 确认选择当前结果
      if (isSkillView) {
        if (skillSearchResults[currentResultIndex]) {
          selectSkill(skillSearchResults[currentResultIndex].id);
        }
      } else {
        if (promptSearchResults[currentResultIndex]) {
          selectPrompt(promptSearchResults[currentResultIndex].id);
        }
      }
      searchInputRef.current?.blur();
    }
  };

  // Listen for shortcut events
  useEffect(() => {
    const handleNewPrompt = () => {
      setIsCreateModalOpen(true);
    };
    const handleSearch = () => {
      searchInputRef.current?.focus();
    };

    window.addEventListener("shortcut:newPrompt", handleNewPrompt);
    window.addEventListener("shortcut:search", handleSearch);

    return () => {
      window.removeEventListener("shortcut:newPrompt", handleNewPrompt);
      window.removeEventListener("shortcut:search", handleSearch);
    };
  }, []);

  // Listen for modal open events.
  useEffect(() => {
    function handleOpenSkillModal() {
      setIsCreateSkillModalOpen(true);
    }

    document.addEventListener("open-create-skill-modal", handleOpenSkillModal);

    return () => {
      document.removeEventListener(
        "open-create-skill-modal",
        handleOpenSkillModal,
      );
    };
  }, []);

  const handleCreatePrompt = async (data: {
    title: string;
    description?: string;
    promptType?: "text" | "image";
    systemPrompt?: string;
    systemPromptEn?: string;
    userPrompt: string;
    userPromptEn?: string;
    tags?: string[];
    images?: string[];
    folderId?: string;
    source?: string;
  }) => {
    try {
      const prompt = await createPrompt({
        title: data.title,
        description: data.description,
        promptType: data.promptType,
        systemPrompt: data.systemPrompt,
        systemPromptEn: data.systemPromptEn,
        userPrompt: data.userPrompt,
        userPromptEn: data.userPromptEn,
        tags: data.tags || [],
        variables: [],
        images: data.images,
        folderId: data.folderId,
        source: data.source,
      });
      setIsCreateModalOpen(false);
      return prompt;
    } catch (error) {
      console.error("Failed to create prompt:", error);
      return null;
    }
  };

  const toggleTheme = () => {
    setDarkMode(!isDarkMode);
  };

  return (
    <>
      <header
        className="h-12 app-wallpaper-toolbar border-b border-border flex items-center px-4 shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div
          className={`shrink-0 ${webRuntime ? "w-52" : "w-8"}`}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {webRuntime ? (
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GlobeIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="truncate">
                  {t("header.topbarWebTitle", "PromptHub Web")}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              title={
                isSidebarCollapsed
                  ? t("common.expand", "Expand")
                  : t("common.collapse", "Collapse")
              }
              aria-label={
                isSidebarCollapsed
                  ? t("common.expand", "Expand")
                  : t("common.collapse", "Collapse")
              }
            >
              <PanelLeftIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 搜索框 - 居中，带清除按钮、结果计数和导航 */}
        <div className="flex-1 flex justify-center px-3">
          <div className="w-full max-w-lg relative flex items-center">
            <div className="app-wallpaper-search absolute inset-0 rounded-lg border pointer-events-none" />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
            <input
              ref={searchInputRef}
              type="text"
                placeholder={
                  appModule === "skill"
                    ? isProjectSkillView
                      ? t("header.searchProjectSkills", "Search project skills...")
                      : t("header.searchSkill", "Search skills...")
                    : t("header.search")
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                readOnly={false}
                className="relative z-10 w-full h-9 pl-9 pr-32 rounded-lg border border-transparent bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              />
            {/* 右侧控件：结果计数 + 导航按钮 + 清除按钮 */}
            {searchQuery && (
              <div
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                {/* 结果计数 */}
                <span className="text-xs text-muted-foreground tabular-nums px-1">
                  {searchResultCount > 0
                    ? showSearchNavigation
                      ? `${currentResultIndex + 1}/${searchResultCount}`
                      : t("header.resultsCount", {
                          count: searchResultCount,
                          defaultValue: `${searchResultCount} results`,
                        })
                    : t("header.noResults", "No results")}
                </span>
                {/* 上下导航按钮 */}
                {showSearchNavigation && searchResultCount > 1 && (
                  <>
                    <button
                      onClick={() => navigateResult("prev")}
                      className="p-1 rounded hover:bg-accent/60 transition-colors"
                      title={t("header.prevResult", "上一个 (Shift+Tab)")}
                    >
                      <ChevronUpIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => navigateResult("next")}
                      className="p-1 rounded hover:bg-accent/60 transition-colors"
                      title={t("header.nextResult", "下一个 (Tab)")}
                    >
                      <ChevronDownIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </>
                )}
                {/* 清除按钮 */}
                <button
                  onClick={() => setSearchQuery("")}
                    className="p-1 rounded hover:bg-accent/60 transition-colors"
                  title={t("header.clearSearch", "清除搜索")}
                >
                  <XIcon className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 右侧操作按钮 - 只有按钮本身不可拖动 */}
        <div className="flex items-center gap-1 ml-4">
          {/* New Prompt / New Skill */}
          <div
              ref={createMenuRef}
              className="flex items-center rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all ml-4 relative h-8"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <button
                onClick={async () => {
                  if (appModule === "skill") {
                    if (isProjectSkillView) {
                      document.dispatchEvent(
                        new CustomEvent(OPEN_CREATE_SKILL_PROJECT_MODAL_EVENT),
                      );
                    } else {
                      setIsCreateSkillModalOpen(true);
                    }
                  } else {
                    setIsCreateModalOpen(true);
                  }
                }}
                className="flex items-center gap-1.5 h-full px-3 text-sm font-medium active:scale-press-in transition-transform"
              >
                {appModule === "skill" ? (
                  isProjectSkillView ? (
                    <FolderPlusIcon className="w-4 h-4" />
                  ) : (
                    <PlusIcon className="w-4 h-4" />
                  )
                ) : (
                  <PlusIcon className="w-4 h-4" />
                )}
                <span>
                  {appModule === "skill"
                    ? isProjectSkillView
                      ? t("skill.addProject", "Add Project")
                      : t("header.new")
                    : t("header.new")}
                </span>
              </button>
          </div>

          {/* 主题切换 */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {isDarkMode ? (
              <SunIcon className="w-4 h-4" />
            ) : (
              <MoonIcon className="w-4 h-4" />
            )}
          </button>

          {webRuntime && (
            <button
              onClick={() => void logoutWebSession()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              title={t("settings.signOut")}
            >
              <LogOutIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t("settings.signOut")}</span>
            </button>
          )}
        </div>
      </header>

      <Suspense fallback={null}>
        {/* 新建 Prompt 弹窗 */}
        <CreatePromptModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreatePrompt}
          defaultFolderId={selectedFolderId || undefined}
          defaultPromptType={promptTypeFilter === "image" ? "image" : "text"}
        />

        {/* 新建 Skill 弹窗 */}
        <CreateSkillModal
          isOpen={isCreateSkillModalOpen}
          onClose={() => setIsCreateSkillModalOpen(false)}
        />
      </Suspense>
    </>
  );
}
