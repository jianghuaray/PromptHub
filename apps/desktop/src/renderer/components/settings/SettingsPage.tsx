import { useState } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  SettingsIcon,
  PaletteIcon,
  DatabaseIcon,
  InfoIcon,
  ArrowLeftIcon,
  SparklesIcon,
  FolderIcon,
  SearchIcon,
  DownloadIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { GeneralSettings } from "./GeneralSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { AboutSettings } from "./AboutSettings";
import { DataSettings } from "./DataSettings";
import type { DataSettingsSubsectionId } from "./DataSettings";
import { SkillSettings } from "./SkillSettings";
import { isWebRuntime } from "../../runtime";

interface BackupImportControllerLike {
  requestFileSelection: () => void;
  beginImportFromFile: (file: File) => Promise<void>;
}

interface SettingsPageProps {
  onBack: () => void;
  backupImportController?: BackupImportControllerLike;
}

// Settings menu items - use i18n keys instead of hardcoded text
// 设置菜单项 - 使用 key 而非硬编码文本
const DESKTOP_SETTINGS_MENU = [
  { id: "general", labelKey: "settings.general", icon: SettingsIcon },
  { id: "appearance", labelKey: "settings.appearance", icon: PaletteIcon },
  { id: "data", labelKey: "settings.data", icon: DatabaseIcon },
  { id: "skill", labelKey: "settings.skill", icon: SparklesIcon },
  { id: "about", labelKey: "settings.about", icon: InfoIcon },
];

const WEB_SETTINGS_MENU = [
  { id: "appearance", labelKey: "settings.appearance", icon: PaletteIcon },
  { id: "data", labelKey: "settings.data", icon: DatabaseIcon },
  { id: "about", labelKey: "settings.about", icon: InfoIcon },
] as const;

interface SettingsSubmenuItem {
  id: DataSettingsSubsectionId;
  labelKey: string;
  fallback: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const DATA_SETTINGS_SUBMENU_GROUPS: Array<{
  labelKey: string;
  fallback: string;
  items: SettingsSubmenuItem[];
}> = [
  {
    labelKey: "settings.dataSubmenuBasic",
    fallback: "Basic data settings",
    items: [
      {
        id: "local",
        labelKey: "settings.dataPath",
        fallback: "Data directory",
        icon: FolderIcon,
      },
      {
        id: "recovery",
        labelKey: "settings.recoveryScanner",
        fallback: "Data recovery",
        icon: SearchIcon,
      },
    ],
  },
  {
    labelKey: "settings.dataSubmenuImportExport",
    fallback: "Import and export settings",
    items: [
      {
        id: "backup",
        labelKey: "settings.backup",
        fallback: "Backup",
        icon: DownloadIcon,
      },
    ],
  },
];

export function SettingsPage({ onBack, backupImportController }: SettingsPageProps) {
  const webRuntime = isWebRuntime();
  const settingsMenu = webRuntime ? WEB_SETTINGS_MENU : DESKTOP_SETTINGS_MENU;
  const [activeSection, setActiveSection] = useState(
    webRuntime ? "appearance" : "general",
  );
  const [activeDataSubsection, setActiveDataSubsection] =
    useState<DataSettingsSubsectionId>("local");
  const { t } = useTranslation();

  const renderContent = () => {
    switch (activeSection) {
      case "general":
        return <GeneralSettings />;
      case "appearance":
        return <AppearanceSettings />;
      case "data":
        return (
          <DataSettings
            activeSubsection={activeDataSubsection}
            backupImportController={backupImportController}
          />
        );
      case "skill":
        return <SkillSettings />;
      case "about":
        return <AboutSettings />;
    }
  };
  const activeSubmenu =
    !webRuntime && activeSection === "data"
      ? DATA_SETTINGS_SUBMENU_GROUPS
      : null;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 设置侧边栏 */}
      <div className="w-56 app-wallpaper-panel border-r border-border flex flex-col">
        {/* 返回按钮 */}
        <div className="p-3 border-b border-border">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>{t("common.back")}</span>
          </button>
        </div>

        {/* 菜单列表 */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {settingsMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-quick ${
                activeSection === item.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-foreground/80 hover:bg-muted/70"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>
      </div>

      {activeSubmenu ? (
        <div className="w-56 app-wallpaper-panel border-r border-border flex flex-col">
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {activeSubmenu.map((group) => (
              <section key={group.labelKey} className="space-y-1 pb-3">
                <div className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-muted-foreground">
                  <span className="shrink-0">
                    {t(group.labelKey, group.fallback)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveDataSubsection(item.id)}
                    aria-label={t(item.labelKey, item.fallback)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-quick ${
                      activeDataSubsection === item.id
                        ? "bg-primary text-white shadow-sm"
                        : "text-foreground/80 hover:bg-muted/70"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="min-w-0 flex-1 text-left">
                      {t(item.labelKey, item.fallback)}
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </nav>
        </div>
      ) : null}

      {/* 设置内容区 - 自适应宽度 */}
      <div className="flex-1 overflow-y-auto px-6 py-5 app-wallpaper-section">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-lg font-semibold mb-4">
            {t(
              settingsMenu.find((m) => m.id === activeSection)?.labelKey || "",
            )}
          </h1>
          <div
            key={activeSection}
            className="animate-in fade-in slide-in-from-bottom-2 duration-base"
          >
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
