import { useState, useEffect, useMemo, useCallback, useRef, Children, isValidElement, cloneElement, memo, lazy, Suspense, type CSSProperties } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePromptStore, ViewMode } from '../../stores/prompt.store';
import { useFolderStore } from '../../stores/folder.store';
import { useSettingsStore } from '../../stores/settings.store';
import { useUIStore } from '../../stores/ui.store';
import {
  PROMPT_LIST_PANE_WIDTH_DEFAULT,
  PROMPT_LIST_PANE_WIDTH_MAX,
  PROMPT_LIST_PANE_WIDTH_MIN,
} from '../../stores/ui.store';
import { PromptListHeader } from '../prompt/PromptListHeader';

// Lazy load SkillManager for better initial load performance
// 懒加载 SkillManager 以提升初始加载性能
const SkillManager = lazy(() => import('../skill/SkillManager').then(m => ({ default: m.SkillManager })));
const EditPromptModal = lazy(() => import('../prompt/EditPromptModal').then(m => ({ default: m.EditPromptModal })));
const PromptTableView = lazy(() => import('../prompt/PromptTableView').then(m => ({ default: m.PromptTableView })));
const PromptGalleryView = lazy(() => import('../prompt/PromptGalleryView').then(m => ({ default: m.PromptGalleryView })));
const PromptKanbanView = lazy(() => import('../prompt/PromptKanbanView').then(m => ({ default: m.PromptKanbanView })));
const PromptDetailModal = lazy(() => import('../prompt/PromptDetailModal').then(m => ({ default: m.PromptDetailModal })));
const VariableInputModal = lazy(() => import('../prompt/VariableInputModal').then(m => ({ default: m.VariableInputModal })));
const VersionHistoryModal = lazy(() => import('../prompt/VersionHistoryModal').then(m => ({ default: m.VersionHistoryModal })));
const loadingFallback = (
  <div className="flex-1 flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);
import { StarIcon, CopyIcon, HistoryIcon, HashIcon, FolderIcon, SparklesIcon, EditIcon, TrashIcon, CheckIcon, LoaderIcon, XIcon, ClockIcon, GlobeIcon, PinIcon, MessageSquareTextIcon, ImageIcon, SaveIcon, Share2Icon } from 'lucide-react';
import { ContextMenu, ContextMenuItem } from '../ui/ContextMenu';
import { ImagePreviewModal } from '../ui/ImagePreviewModal';
import { LocalImage } from '../ui/LocalImage';
import { Input } from '../ui/Input';
import { handleMarkdownListKeyDown } from '../ui/Textarea';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ColumnResizer } from '../ui/ColumnResizer';
import { useToast } from '../ui/Toast';
import { useTranslation } from 'react-i18next';
import type { Prompt, PromptVersion, UpdatePromptDTO } from '@prompthub/shared/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { defaultSchema } from 'hast-util-sanitize';
import {
  buildPromptCopyText,
  hasUserDefinedPromptVariables,
  resolvePromptContentByLanguage,
} from '../prompt/prompt-copy-utils';
import {
  filterVisiblePrompts,
  sortVisiblePrompts,
} from '../../services/prompt-filter';
import { getFlattenedTree } from './tree/utilities';
import { renderFolderIcon } from './folderIconHelper';

const PROMPT_CARD_ESTIMATED_HEIGHT = 76;

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getHighlightTerms(searchQuery: string): string[] {
  const queryLower = (searchQuery || '').trim().toLowerCase().slice(0, 128);
  if (!queryLower) return [];

  const keywords = queryLower
    .split(/\s+/)
    .filter((k) => k.length > 0 && k.length <= 64);
  const compact = queryLower.replace(/\s+/g, '');

  const terms = [...keywords];
  if (compact && compact.length <= 64 && !terms.includes(compact)) terms.push(compact);

  return Array.from(new Set(terms))
    .filter(Boolean)
    .slice(0, 20)
    .sort((a, b) => b.length - a.length);
}

function renderHighlightedText(text: string, terms: string[], highlightClassName: string) {
  if (!text || terms.length === 0) return text;

  const pattern = terms.map(escapeRegExp).join('|');
  if (!pattern) return text;

  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  if (parts.length <= 1) return text;

  return parts.map((part, idx) => {
    if (!part) return null;
    if (idx % 2 === 1) {
      return (
        <span key={idx} className={highlightClassName}>
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function renderHighlightedChildren(children: any, terms: string[], highlightClassName: string, skipTypes: any[]) {
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      return renderHighlightedText(child, terms, highlightClassName);
    }

    if (!isValidElement(child)) return child;

    if (skipTypes.includes(child.type)) return child;

    const props = (child.props ?? {}) as any;
    const nextChildren = renderHighlightedChildren(props.children, terms, highlightClassName, skipTypes);
    return cloneElement(child as any, { ...props, children: nextChildren });
  });
}

// Prompt card component (compact version) - wrapped with React.memo for performance
// Prompt 卡片组件（紧凑版本）- 使用 React.memo 包装以提升性能
const PromptCard = memo(function PromptCard({
  prompt,
  isSelected,
  onSelect,
  onContextMenu,
  highlightTerms
}: {
  prompt: Prompt;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  highlightTerms: string[];
}) {
  const highlightClassName = isSelected
    ? 'bg-white/20 text-white rounded px-0.5'
    : 'bg-primary/15 text-primary rounded px-0.5';

  return (
    <div
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`
        w-full text-left px-3 py-2.5 rounded-lg cursor-pointer
        transition-all duration-base animate-in fade-in slide-in-from-left-2
        ${isSelected
          ? 'bg-primary text-white'
          : 'prompt-list-card bg-card hover:bg-accent'
        }
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {prompt.isPinned && (
            <PinIcon className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-white' : 'text-primary'}`} />
          )}
          {/* Prompt type icon - only show for image/media type */}
          {prompt.promptType === 'image' && (
            <ImageIcon className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-white/70' : 'text-blue-500'}`} />
          )}
          <h3
            className="font-medium text-sm leading-snug break-words line-clamp-2"
            title={prompt.title}
          >
            {renderHighlightedText(prompt.title, highlightTerms, highlightClassName)}
          </h3>
        </div>
        {prompt.isFavorite && (
          <StarIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'fill-white text-white' : 'fill-yellow-400 text-yellow-400'
            }`} />
        )}
      </div>
      {prompt.description && (
        <p className={`text-xs line-clamp-2 break-words mt-0.5 ${isSelected ? 'text-white/70' : 'text-muted-foreground'
          }`}>
          {renderHighlightedText(prompt.description, highlightTerms, highlightClassName)}
        </p>
      )}
    </div>
  );
});

interface VirtualizedPromptListProps {
  prompts: Prompt[];
  selectedPromptIdSet: Set<string>;
  highlightTerms: string[];
  onSelect: (prompt: Prompt, event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent, prompt: Prompt) => void;
}

/**
 * Virtualized list of prompt cards. Replaces the previous chunked-render
 * scheme that progressively painted more cards via setTimeout.
 *
 * The component owns its own scroll element so the parent pane can stay
 * `overflow-hidden`. Heights are dynamically measured because card height
 * varies with title wrapping and the optional description line. We seed
 * estimateSize with a typical card height so initial scrollbar geometry is
 * roughly correct before measurement runs.
 *
 * Wrapped in React.memo so that re-renders triggered by modal toggles or
 * AI workbench state in the parent do not cascade into the (potentially
 * thousands-strong) list — only changes to the shallow-equal prop set
 * actually invalidate the list view.
 *
 * 虚拟化的 prompt 列表，替代以前的"setTimeout 分批渲染"补丁。
 * 组件自带滚动容器，父级保持 overflow-hidden 即可；卡片高度因标题换行与
 * 描述显示而异，所以使用 measureElement 动态测量；estimateSize 给一个典型
 * 高度让初始滚动条几何大致正确。
 *
 * 用 React.memo 包裹，避免父级 modal 开关或 AI 工作区状态变化把上千条卡片
 * 列表全量重渲染；只有真正影响展示的 props 变化才会触发列表重新渲染。
 */
const VirtualizedPromptList = memo(function VirtualizedPromptList({
  prompts,
  selectedPromptIdSet,
  highlightTerms,
  onSelect,
  onContextMenu,
}: VirtualizedPromptListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: prompts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => PROMPT_CARD_ESTIMATED_HEIGHT,
    overscan: 8,
    getItemKey: (index) => prompts[index]?.id ?? `__missing-${index}`,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  // Match the previous `<div className="p-3 space-y-2">` layout: 12px gutter
  // around the list and 8px gap between cards. Padding lives on the spacer
  // wrapper rather than the inner box because absolutely positioned children
  // ignore their parent's padding.
  // 还原原来 `<div className="p-3 space-y-2">` 的视觉：列表四周 12px 间距、
  // 卡片之间 8px gap。padding 写在外层 spacer 上，因为绝对定位的子元素不会
  // 受父级 padding 影响，需要靠 top/left/height 自己处理上下左右间距。
  const LIST_PADDING_X = 12;
  const LIST_PADDING_TOP = 12;
  const LIST_PADDING_BOTTOM = 12;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div
        style={{
          position: 'relative',
          height: `${totalHeight + LIST_PADDING_TOP + LIST_PADDING_BOTTOM}px`,
        }}
      >
        {virtualItems.map((virtualRow) => {
          const prompt = prompts[virtualRow.index];
          if (!prompt) return null;
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: LIST_PADDING_X,
                right: LIST_PADDING_X,
                transform: `translateY(${virtualRow.start + LIST_PADDING_TOP}px)`,
                paddingBottom: 8,
              }}
            >
              <PromptCard
                prompt={prompt}
                isSelected={selectedPromptIdSet.has(prompt.id)}
                onSelect={(e) => onSelect(prompt, e)}
                onContextMenu={(e) => onContextMenu(e, prompt)}
                highlightTerms={highlightTerms}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

type DetailInlineEditDraft = {
  title: string;
  systemPrompt: string;
  userPrompt: string;
};

type DetailInlineEditField = 'title' | 'systemPrompt' | 'userPrompt';

function createDetailInlineEditDraft(
  prompt: Prompt,
  showEnglish: boolean,
): DetailInlineEditDraft {
  return {
    title: prompt.title,
    systemPrompt: showEnglish ? (prompt.systemPromptEn || prompt.systemPrompt || '') : (prompt.systemPrompt || ''),
    userPrompt: showEnglish ? (prompt.userPromptEn || prompt.userPrompt) : prompt.userPrompt,
  };
}

function getDetailInlineSystemPromptField(
  prompt: Prompt,
  showEnglish: boolean,
): 'systemPrompt' | 'systemPromptEn' {
  return showEnglish && !!prompt.systemPromptEn ? 'systemPromptEn' : 'systemPrompt';
}

function getDetailInlineUserPromptField(
  prompt: Prompt,
  showEnglish: boolean,
): 'userPrompt' | 'userPromptEn' {
  return showEnglish && !!prompt.userPromptEn ? 'userPromptEn' : 'userPrompt';
}

export function MainContent() {
  return <PromptSkillMainContent />;
}

function PromptSkillMainContent() {
  const { t, i18n } = useTranslation();
  const prompts = usePromptStore((state) => state.prompts);
  const selectedId = usePromptStore((state) => state.selectedId);
  const selectedIds = usePromptStore((state) => state.selectedIds);
  const lastSelectedId = usePromptStore((state) => state.lastSelectedId);
  const selectPrompt = usePromptStore((state) => state.selectPrompt);
  const setSelectedIds = usePromptStore((state) => state.setSelectedIds);
  const createPrompt = usePromptStore((state) => state.createPrompt);
  const toggleFavorite = usePromptStore((state) => state.toggleFavorite);
  const togglePinned = usePromptStore((state) => state.togglePinned);
  const deletePrompt = usePromptStore((state) => state.deletePrompt);
  const updatePrompt = usePromptStore((state) => state.updatePrompt);
  const searchQuery = usePromptStore((state) => state.searchQuery);
  const filterTags = usePromptStore((state) => state.filterTags);
  const toggleFilterTag = usePromptStore((state) => state.toggleFilterTag);
  const sortBy = usePromptStore((state) => state.sortBy);
  const sortOrder = usePromptStore((state) => state.sortOrder);
  const viewMode = usePromptStore((state) => state.viewMode);
  const incrementUsageCount = usePromptStore((state) => state.incrementUsageCount);
  // Resizable prompt-list pane width (#119)
  const promptListPaneWidth = useUIStore((state) => state.promptListPaneWidth);
  const setPromptListPaneWidth = useUIStore(
    (state) => state.setPromptListPaneWidth,
  );
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const unlockedFolderIds = useFolderStore((state) => state.unlockedFolderIds);
  const folders = useFolderStore((state) => state.folders);

  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const [isVariableModalOpen, setIsVariableModalOpen] = useState(false);
  // 用于列表/画廊视图复制时的变量弹窗
  const [isCopyVariableModalOpen, setIsCopyVariableModalOpen] = useState(false);
  const [copyPrompt, setCopyPrompt] = useState<Prompt | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; prompt: Prompt } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; prompt: Prompt | null }>({ isOpen: false, prompt: null });
  const renderMarkdownPref = useSettingsStore((state) => state.renderMarkdown);
  const setRenderMarkdownPref = useSettingsStore((state) => state.setRenderMarkdown);
  const [renderMarkdownEnabled, setRenderMarkdownEnabled] = useState(renderMarkdownPref);
  const [showEnglish, setShowEnglish] = useState(false);
  const [isTagDropActive, setIsTagDropActive] = useState(false);
  const promptTypeFilter = usePromptStore((state) => state.promptTypeFilter);
  const setPromptTypeFilter = usePromptStore((state) => state.setPromptTypeFilter);
  const tagFilterMode = useSettingsStore((state) => state.tagFilterMode);
  const uiViewMode = useUIStore((state) => state.viewMode);
  const { showToast } = useToast();

  const handleSelectPrompt = useCallback((prompt: Prompt, e: React.MouseEvent) => {
    // Check if we are in multi-select mode (Ctrl/Cmd/Shift)
    // 检查是否在多选模式 (Ctrl/Cmd/Shift)
    if (e.metaKey || e.ctrlKey) {
      // Toggle selection
      if (selectedIds.includes(prompt.id)) {
        setSelectedIds(selectedIds.filter(id => id !== prompt.id));
      } else {
        setSelectedIds([...selectedIds, prompt.id]);
      }
    } else if (e.shiftKey) {
      // Range selection (simplified: add to selection for now)
      // 范围选择（简化：目前只添加到选择）
      // Ideally this would find the range between last selected and current
      if (!selectedIds.includes(prompt.id)) {
        setSelectedIds([...selectedIds, prompt.id]);
      }
    } else {
      // Single select
      // 单选
      selectPrompt(prompt.id);
    }
  }, [selectedIds, selectPrompt, setSelectedIds]);

  const preferEnglish = useMemo(() => {
    const lang = (i18n.language || '').toLowerCase();
    return !(lang.startsWith('zh'));
  }, [i18n.language]);

  const uiLangTag = useMemo(() => {
    const lang = (i18n.language || '').toLowerCase();
    if (!lang) return 'LANG';
    if (lang.startsWith('zh')) return 'ZH';
    if (lang.startsWith('ja')) return 'JA';
    if (lang.startsWith('en')) return 'EN';
    return lang.split('-')[0].toUpperCase();
  }, [i18n.language]);

  const highlightTerms = useMemo(() => getHighlightTerms(searchQuery), [searchQuery]);
  const selectedPromptIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Reset selected prompt when switching folders (privacy)
  // 切换 Folder 时重置选中的 Prompt (隐私保护)
  useEffect(() => {
    selectPrompt(null);
  }, [selectedFolderId, selectPrompt]);

  const showCopyNotification = useSettingsStore((state) => state.showCopyNotification);

  useEffect(() => {
    setRenderMarkdownEnabled((prev) =>
      prev === renderMarkdownPref ? prev : renderMarkdownPref,
    );
  }, [renderMarkdownPref]);

  const sanitizeSchema: any = useMemo(() => {
    const schema = { ...defaultSchema, attributes: { ...defaultSchema.attributes } };
    schema.attributes.code = [...(schema.attributes.code || []), ['className']];
    schema.attributes.span = [...(schema.attributes.span || []), ['className']];
    schema.attributes.pre = [...(schema.attributes.pre || []), ['className']];
    return schema;
  }, []);

  const rehypePlugins = useMemo(
    () => [
      [rehypeHighlight, { ignoreMissing: true }] as any,
      [rehypeSanitize, sanitizeSchema] as any,
    ],
    [sanitizeSchema],
  );

  const highlightClassName = useMemo(() => 'bg-primary/15 text-primary rounded px-0.5', []);

  const markdownComponents = useMemo(() => {
    const Code = (props: any) => <code className="px-1 py-0.5 rounded bg-muted font-mono text-[13px]" {...props} />;
    const Pre = (props: any) => (
      <pre className="p-3 rounded-lg bg-muted overflow-x-auto text-[13px] leading-relaxed" {...props} />
    );
    const skipTypes = [Code, Pre];

    const withHighlight = (Tag: any, className: string) => (props: any) => (
      <Tag className={className} {...props}>
        {renderHighlightedChildren(props.children, highlightTerms, highlightClassName, skipTypes)}
      </Tag>
    );

    return {
      h1: withHighlight('h1', 'text-2xl font-bold mb-4 text-foreground'),
      h2: withHighlight('h2', 'text-xl font-semibold mb-3 mt-5 text-foreground'),
      h3: withHighlight('h3', 'text-lg font-semibold mb-3 mt-4 text-foreground'),
      h4: withHighlight('h4', 'text-base font-semibold mb-2 mt-3 text-foreground'),
      p: withHighlight('p', 'mb-3 leading-relaxed text-foreground/90'),
      ul: withHighlight('ul', 'list-disc pl-5 mb-3 space-y-1'),
      ol: withHighlight('ol', 'list-decimal pl-5 mb-3 space-y-1'),
      li: withHighlight('li', 'leading-relaxed'),
      code: Code,
      pre: Pre,
      blockquote: withHighlight('blockquote', 'border-l-4 border-border pl-3 text-muted-foreground italic mb-3'),
      hr: () => <hr className="my-4 border-border" />,
      table: (props: any) => <table className="table-auto border-collapse w-full text-sm mb-3" {...props} />,
      th: withHighlight('th', 'border border-border px-2 py-1 bg-muted text-left font-medium'),
      td: withHighlight('td', 'border border-border px-2 py-1'),
      a: (props: any) => (
        <a className="text-primary hover:underline" {...props} target="_blank" rel="noreferrer">
          {renderHighlightedChildren(props.children, highlightTerms, highlightClassName, skipTypes)}
        </a>
      ),
      strong: withHighlight('strong', 'font-semibold text-foreground'),
      em: withHighlight('em', 'italic text-foreground/90'),
    };
  }, [highlightTerms, highlightClassName]);

  const renderPromptContent = (content?: string) => {
    if (!content) {
      return (
        <div className="p-4 rounded-xl app-wallpaper-surface border border-border text-sm text-muted-foreground">
          {t('prompt.noContent')}
        </div>
      );
    }

    if (!renderMarkdownEnabled) {
      return (
        <div className="p-4 rounded-xl app-wallpaper-surface border border-border font-mono text-[14px] leading-relaxed whitespace-pre-wrap break-words">
          {renderHighlightedText(content, highlightTerms, highlightClassName)}
        </div>
      );
    }

    return (
      <div className="p-4 rounded-xl app-wallpaper-surface border border-border text-[15px] leading-relaxed markdown-content space-y-3 break-words">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={rehypePlugins}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  const toggleRenderMarkdown = () => {
    const next = !renderMarkdownEnabled;
    setRenderMarkdownEnabled(next);
    setRenderMarkdownPref(next);
  };

  const handleRestoreVersion = async (version: PromptVersion) => {
    if (selectedPrompt) {
      await updatePrompt(selectedPrompt.id, {
        systemPrompt: version.systemPrompt,
        userPrompt: version.userPrompt,
      });
      showToast(t('toast.restored'), 'success');
    }
  };

  // Filter prompts - use useMemo to respond correctly to searchQuery changes
  // 过滤 Prompts - 使用 useMemo 确保正确响应 searchQuery 变化
  const filteredPrompts = useMemo(() => {
    return filterVisiblePrompts({
      prompts,
      selectedFolderId,
      folders,
      unlockedFolderIds,
      searchQuery,
      filterTags,
      promptTypeFilter,
    });
  }, [prompts, selectedFolderId, folders, unlockedFolderIds, searchQuery, filterTags, promptTypeFilter]);

  // Sorting (pinned prompts always first)
  // 排序（置顶的始终在最前面）
  const sortedPrompts = useMemo(
    () => sortVisiblePrompts(filteredPrompts, sortBy, sortOrder),
    [filteredPrompts, sortBy, sortOrder],
  );

  // Sorted prompts feed both the inline list (which uses @tanstack/react-virtual)
  // and the gallery / kanban views (which virtualize internally). All consumers
  // can now safely receive the full sorted set without manual chunking.
  // 排序后的 prompt 列表：list 视图通过 @tanstack/react-virtual 虚拟化，gallery /
  // kanban 视图各自内部虚拟化。三个消费方都可以安全地拿到完整数据，不再需要
  // 手写的分批渲染补丁。
  const visiblePrompts = sortedPrompts;

  useEffect(() => {
    if (selectedId || !lastSelectedId) {
      return;
    }

    const canRestore = visiblePrompts.some((prompt) => prompt.id === lastSelectedId);
    if (canRestore) {
      selectPrompt(lastSelectedId);
    }
  }, [lastSelectedId, selectPrompt, selectedId, visiblePrompts]);

  const selectedPrompt = prompts.find((p) => p.id === selectedId);

  // Auto-select prompt language based on UI language (if English version exists)
  // 根据界面语言自动选择 Prompt 语言（如果有英文版本）
  useEffect(() => {
    if (!selectedPrompt) {
      setShowEnglish((prev) => (prev ? false : prev));
      return;
    }
    const hasEnglish = !!(selectedPrompt.systemPromptEn || selectedPrompt.userPromptEn);
    if (!hasEnglish) {
      setShowEnglish((prev) => (prev ? false : prev));
      return;
    }
    setShowEnglish((prev) => (prev === preferEnglish ? prev : preferEnglish));
  }, [selectedPrompt?.id, selectedPrompt?.systemPromptEn, selectedPrompt?.userPromptEn, preferEnglish]);

  // Editing prompt for table view
  // 用于表格视图的编辑 prompt
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [isDetailInlineEditing, setIsDetailInlineEditing] = useState(false);
  const [isDetailInlineSaving, setIsDetailInlineSaving] = useState(false);
  const [detailInlineActiveField, setDetailInlineActiveField] =
    useState<DetailInlineEditField>('title');
  const [detailInlineDraft, setDetailInlineDraft] = useState<DetailInlineEditDraft>({
    title: '',
    systemPrompt: '',
    userPrompt: '',
  });
  const detailTitleInputRef = useRef<HTMLInputElement>(null);
  const detailSystemPromptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const detailUserPromptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const detailInlineCurrentValues = useMemo(() => {
    if (!selectedPrompt) {
      return null;
    }
    return createDetailInlineEditDraft(selectedPrompt, showEnglish);
  }, [selectedPrompt, showEnglish]);

  const detailInlineUserPromptField = useMemo<'userPrompt' | 'userPromptEn'>(() => {
    if (!selectedPrompt) {
      return 'userPrompt';
    }
    return getDetailInlineUserPromptField(selectedPrompt, showEnglish);
  }, [selectedPrompt, showEnglish]);

  const detailInlineSystemPromptField = useMemo<'systemPrompt' | 'systemPromptEn'>(() => {
    if (!selectedPrompt) {
      return 'systemPrompt';
    }
    return getDetailInlineSystemPromptField(selectedPrompt, showEnglish);
  }, [selectedPrompt, showEnglish]);

  useEffect(() => {
    setIsDetailInlineEditing(false);
    setIsDetailInlineSaving(false);
    setDetailInlineActiveField('title');
  }, [selectedPrompt?.id]);

  useEffect(() => {
    if (!selectedPrompt) {
      setDetailInlineDraft({ title: '', systemPrompt: '', userPrompt: '' });
      return;
    }
    if (isDetailInlineEditing) {
      return;
    }
    setDetailInlineDraft(createDetailInlineEditDraft(selectedPrompt, showEnglish));
  }, [
    isDetailInlineEditing,
    selectedPrompt,
    selectedPrompt?.title,
    selectedPrompt?.userPrompt,
    selectedPrompt?.userPromptEn,
    showEnglish,
  ]);

  useEffect(() => {
    if (!isDetailInlineEditing) {
      return;
    }
    if (detailInlineActiveField === 'systemPrompt') {
      detailSystemPromptTextareaRef.current?.focus();
      return;
    }
    if (detailInlineActiveField === 'userPrompt') {
      detailUserPromptTextareaRef.current?.focus();
      return;
    }
    detailTitleInputRef.current?.focus();
    detailTitleInputRef.current?.select();
  }, [detailInlineActiveField, isDetailInlineEditing]);

  const openDetailInlineEdit = useCallback((field: DetailInlineEditField = 'title') => {
    if (!selectedPrompt) {
      return;
    }
    setDetailInlineDraft(createDetailInlineEditDraft(selectedPrompt, showEnglish));
    setDetailInlineActiveField(field);
    setIsDetailInlineEditing(true);
  }, [selectedPrompt, showEnglish]);

  const cancelDetailInlineEdit = useCallback(() => {
    if (selectedPrompt) {
      setDetailInlineDraft(createDetailInlineEditDraft(selectedPrompt, showEnglish));
    } else {
      setDetailInlineDraft({ title: '', systemPrompt: '', userPrompt: '' });
    }
    setDetailInlineActiveField('title');
    setIsDetailInlineEditing(false);
    setIsDetailInlineSaving(false);
  }, [selectedPrompt, showEnglish]);

  const hasDetailInlineChanges = useMemo(() => {
    if (!detailInlineCurrentValues) {
      return false;
    }

    return (
      detailInlineDraft.title.trim() !== detailInlineCurrentValues.title.trim() ||
      detailInlineDraft.systemPrompt !== detailInlineCurrentValues.systemPrompt ||
      detailInlineDraft.userPrompt !== detailInlineCurrentValues.userPrompt
    );
  }, [detailInlineCurrentValues, detailInlineDraft.title, detailInlineDraft.systemPrompt, detailInlineDraft.userPrompt]);

  const canSaveDetailInlineEdit = useMemo(() => {
    return (
      !!selectedPrompt &&
      !isDetailInlineSaving &&
      detailInlineDraft.title.trim().length > 0 &&
      detailInlineDraft.userPrompt.trim().length > 0 &&
      hasDetailInlineChanges
    );
  }, [
    detailInlineDraft.title,
    detailInlineDraft.userPrompt,
    hasDetailInlineChanges,
    isDetailInlineSaving,
    selectedPrompt,
  ]);

  const saveDetailInlineEdit = useCallback(async () => {
    if (!selectedPrompt || !canSaveDetailInlineEdit) {
      return;
    }

    const nextTitle = detailInlineDraft.title.trim();
    const nextSystemPrompt = detailInlineDraft.systemPrompt;
    const nextUserPrompt = detailInlineDraft.userPrompt;
    const updateData: UpdatePromptDTO = {
      title: nextTitle,
    };
    updateData[detailInlineSystemPromptField] = nextSystemPrompt;
    updateData[detailInlineUserPromptField] = nextUserPrompt;

    setIsDetailInlineSaving(true);
    try {
      await updatePrompt(selectedPrompt.id, updateData);
      showToast(t('toast.saved'), 'success');
      setDetailInlineActiveField('title');
      setIsDetailInlineEditing(false);
    } catch (error) {
      console.error('Failed to save inline prompt edits:', error);
      showToast(t('toast.updateFailed'), 'error');
    } finally {
      setIsDetailInlineSaving(false);
    }
  }, [
    canSaveDetailInlineEdit,
    detailInlineDraft.title,
    detailInlineDraft.systemPrompt,
    detailInlineDraft.userPrompt,
    detailInlineSystemPromptField,
    detailInlineUserPromptField,
    selectedPrompt,
    showToast,
    t,
    updatePrompt,
  ]);

  const handleDetailInlineEditKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelDetailInlineEdit();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        void saveDetailInlineEdit();
      }
    },
    [cancelDetailInlineEdit, saveDetailInlineEdit],
  );

  // Handle copying prompt - check for variables first
  // 处理复制 Prompt - 先检查是否有变量
  const handleCopyPrompt = async (prompt: Prompt) => {
    const resolvedPrompt = resolvePromptContentByLanguage(prompt, showEnglish);

    if (
      hasUserDefinedPromptVariables(
        resolvedPrompt.systemPrompt,
        resolvedPrompt.userPrompt,
      )
    ) {
      // 有变量，打开弹窗让用户填写
      setCopyPrompt(prompt);
      setIsCopyVariableModalOpen(true);
    } else {
      // 没有变量，直接复制（包含 systemPrompt 和 userPrompt）
      // No variables, copy directly (include both systemPrompt and userPrompt)
      await navigator.clipboard.writeText(buildPromptCopyText(resolvedPrompt));
      await incrementUsageCount(prompt.id);
      showToast(t('toast.copied'), 'success', showCopyNotification);
    }
  };

  const handleDuplicatePrompt = useCallback(async (prompt: Prompt) => {
    const duplicatedPrompt = await createPrompt({
      title: `${prompt.title} (${t('prompt.duplicateSuffix', 'Duplicate')})`,
      description: prompt.description ?? undefined,
      promptType: prompt.promptType,
      systemPrompt: prompt.systemPrompt ?? undefined,
      systemPromptEn: prompt.systemPromptEn ?? undefined,
      userPrompt: prompt.userPrompt,
      userPromptEn: prompt.userPromptEn ?? undefined,
      variables: prompt.variables,
      tags: prompt.tags,
      folderId: prompt.folderId,
      images: prompt.images,
      videos: prompt.videos,
      source: prompt.source ?? undefined,
      notes: prompt.notes ?? undefined,
    });

    selectPrompt(duplicatedPrompt.id);
    showToast(t('prompt.promptDuplicated', 'Prompt duplicate created'), 'success');
  }, [createPrompt, selectPrompt, showToast, t]);

  // Handle deleting prompt (for table view)
  // 处理删除 Prompt（表格视图用）
  const handleDeletePrompt = useCallback((prompt: Prompt) => {
    setDeleteConfirm({ isOpen: true, prompt });
  }, []);

  // Confirm delete
  // 确认删除
  const confirmDelete = useCallback(async () => {
    if (deleteConfirm.prompt) {
      await deletePrompt(deleteConfirm.prompt.id);
      showToast(t('prompt.promptDeleted'), 'success');
    }
    setDeleteConfirm({ isOpen: false, prompt: null });
  }, [deleteConfirm.prompt, deletePrompt, showToast, t]);

  // Detail modal state
  // 查看详情弹窗状态
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailPrompt, setDetailPrompt] = useState<Prompt | null>(null);
  // Version history modal state
  // 版本历史弹窗状态
  const [isVersionModalOpenTable, setIsVersionModalOpenTable] = useState(false);
  const [versionHistoryPrompt, setVersionHistoryPrompt] = useState<Prompt | null>(null);
  const flattenedFolders = useMemo(
    () => getFlattenedTree(folders, new Set(folders.map((folder) => folder.id))),
    [folders],
  );
  const folderNameById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );
  const folderPathById = useMemo(() => {
    const pathMap = new Map<string, string>();

    for (const folder of folders) {
      const ancestors: string[] = [];
      let currentParentId = folder.parentId ?? null;

      while (currentParentId) {
        const parentName = folderNameById.get(currentParentId);
        if (!parentName) break;

        ancestors.unshift(parentName);
        const parentFolder = folders.find((item) => item.id === currentParentId);
        currentParentId = parentFolder?.parentId ?? null;
      }

      if (ancestors.length > 0) {
        pathMap.set(folder.id, ancestors.join(' / '));
      }
    }

    return pathMap;
  }, [folders, folderNameById]);

  const handleMovePrompt = useCallback(async (prompt: Prompt, folderId: string | undefined) => {
    await updatePrompt(prompt.id, { folderId });
    const folder = folderId ? folders.find((item) => item.id === folderId) : undefined;
    showToast(
      folder
        ? `${t('toast.movedToFolder')}「${folder.name}」`
        : t('prompt.movedToNoFolder', 'Removed from current folder'),
      'success',
    );
  }, [folders, showToast, t, updatePrompt]);

  // View details - show modal
  // 查看详情 - 弹窗显示
  const handleViewDetail = (prompt: Prompt) => {
    setDetailPrompt(prompt);
    setIsDetailModalOpen(true);
  };

  // Version history
  // 版本历史
  const handleVersionHistory = (prompt: Prompt) => {
    setVersionHistoryPrompt(prompt);
    setIsVersionModalOpenTable(true);
  };

  // Restore version (table view)
  // 恢复版本（表格视图用）
  const handleRestoreVersionFromTable = async (version: PromptVersion) => {
    if (versionHistoryPrompt) {
      await updatePrompt(versionHistoryPrompt.id, {
        systemPrompt: version.systemPrompt,
        userPrompt: version.userPrompt,
      });
      showToast(t('toast.restored'), 'success');
      setIsVersionModalOpenTable(false);
      setVersionHistoryPrompt(null);
    }
  };

  // Handle share prompt as JSON
  const handleSharePrompt = async (prompt: Prompt) => {
    // Extract variables logic
    const extractVariables = (text: string): string[] => {
      const regex = /\{\{([^}]+)\}\}/g;
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (!matches.includes(match[1])) {
          matches.push(match[1]);
        }
      }
      return matches;
    };

    const allVariables = [
      ...extractVariables(prompt.systemPrompt || ''),
      ...extractVariables(prompt.userPrompt),
    ].filter((v, i, arr) => arr.indexOf(v) === i);
    
    const data = {
      name: prompt.title,
      description: prompt.description,
      userPrompt: prompt.userPrompt,
      systemPrompt: prompt.systemPrompt,
      userPromptEn: prompt.userPromptEn,
      systemPromptEn: prompt.systemPromptEn,
      tags: prompt.tags,
      variables: allVariables,
      source: 'prompthub',
      version: '1.0'
    };
    
    const jsonStr = JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(jsonStr);
    
    const checksum = `${jsonStr.length}-${jsonStr.substring(0, 10)}`;
    sessionStorage.setItem('lastCopiedPromptSignature', checksum);
    
    showToast(t('toast.copied'), 'success');
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  // Context menu anchor (also used by table view)
  // 处理 AI 测试使用次数增加并缓存结果
  const handleContextMenu = useCallback((e: React.MouseEvent, prompt: Prompt) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, prompt });
  }, []);

  const handleTagFilterClick = useCallback((tag: string) => {
    if (tagFilterMode === 'single') {
      const shouldClear = filterTags.length === 1 && filterTags[0] === tag;
      usePromptStore.setState({ filterTags: shouldClear ? [] : [tag] });
      return;
    }

    toggleFilterTag(tag);
  }, [filterTags, tagFilterMode, toggleFilterTag]);

  const handleDetailAddTag = useCallback(
    async (rawTag: string) => {
      const normalizedTag = rawTag.trim();
      if (!selectedPrompt || !normalizedTag || selectedPrompt.tags.includes(normalizedTag)) {
        return;
      }

      try {
        await updatePrompt(selectedPrompt.id, {
          tags: [...selectedPrompt.tags, normalizedTag],
        });
        showToast(t('toast.saved'), 'success');
      } catch (error) {
        console.error('Failed to add prompt tag from detail view:', error);
        showToast(t('toast.updateFailed'), 'error');
      }
    },
    [selectedPrompt, showToast, t, updatePrompt],
  );

  const handleDetailRemoveTag = useCallback(
    async (tagToRemove: string) => {
      if (!selectedPrompt) {
        return;
      }

      try {
        await updatePrompt(selectedPrompt.id, {
          tags: selectedPrompt.tags.filter((tag) => tag !== tagToRemove),
        });
        showToast(t('toast.saved'), 'success');
      } catch (error) {
        console.error('Failed to remove prompt tag from detail view:', error);
        showToast(t('toast.updateFailed'), 'error');
      }
    },
    [selectedPrompt, showToast, t, updatePrompt],
  );

  const handleDetailTagDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsTagDropActive(false);

      const droppedTag = event.dataTransfer.getData('application/x-prompthub-tag');
      if (!droppedTag) {
        return;
      }

      void handleDetailAddTag(droppedTag);
    },
    [handleDetailAddTag],
  );

  const handleDetailTagDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('application/x-prompthub-tag')) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsTagDropActive(true);
  }, []);

  const handleDetailTagDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsTagDropActive(false);
  }, []);

  // Memoize context menu items to avoid re-creating the array on every render
  // 使用 useMemo 缓存右键菜单项，避免每次渲染都重新创建数组
  const menuItems: ContextMenuItem[] = useMemo(() => {
    if (!contextMenu) return [];

    const moveTargetItems: ContextMenuItem[] = [
      {
        label: t('prompt.noFolder') || 'No folder',
        onClick: () => void handleMovePrompt(contextMenu.prompt, undefined),
        disabled: !contextMenu.prompt.folderId,
      },
      ...flattenedFolders.map((folder) => ({
        label: folder.name,
        description: folderPathById.get(folder.id),
        icon: renderFolderIcon(folder.icon),
        insetLevel: folder.depth,
        onClick: () => void handleMovePrompt(contextMenu.prompt, folder.id),
        disabled: contextMenu.prompt.folderId === folder.id,
      })),
    ];

    return [
      {
        label: t('prompt.viewDetail'),
        icon: <CheckIcon className="w-4 h-4" />,
        onClick: () => handleViewDetail(contextMenu.prompt),
      },
      {
        label: t('prompt.edit'),
        icon: <EditIcon className="w-4 h-4" />,
        onClick: () => setEditingPrompt(contextMenu.prompt),
      },
      {
        label: t('prompt.copy'),
        icon: <CopyIcon className="w-4 h-4" />,
        onClick: () => handleCopyPrompt(contextMenu.prompt),
      },
      {
        label: t('prompt.duplicate', 'Create Duplicate'),
        icon: <CopyIcon className="w-4 h-4" />,
        onClick: () => void handleDuplicatePrompt(contextMenu.prompt),
      },
      {
        label: t('prompt.shareJSON', '分享为 JSON'),
        icon: <Share2Icon className="w-4 h-4" />,
        onClick: () => handleSharePrompt(contextMenu.prompt),
      },
      {
        label: contextMenu.prompt.isFavorite ? (t('prompt.removeFromFavorites') || '取消收藏') : (t('prompt.addToFavorites') || '收藏'),
        icon: <StarIcon className={`w-4 h-4 ${contextMenu.prompt.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />,
        onClick: () => toggleFavorite(contextMenu.prompt.id),
      },
      {
        label: contextMenu.prompt.isPinned ? t('prompt.unpin') : t('prompt.pin'),
        icon: <PinIcon className={`w-4 h-4 ${contextMenu.prompt.isPinned ? 'fill-primary text-primary' : ''}`} />,
        onClick: () => togglePinned(contextMenu.prompt.id),
      },
      {
        label: t('prompt.history'),
        icon: <HistoryIcon className="w-4 h-4" />,
        onClick: () => handleVersionHistory(contextMenu.prompt),
      },
      {
        label: t('prompt.moveTo', 'Move to...'),
        icon: <FolderIcon className="w-4 h-4" />,
        children: moveTargetItems,
        childrenClassName: 'max-h-[280px] overflow-y-auto',
      },
      {
        label: t('prompt.delete'),
        icon: <TrashIcon className="w-4 h-4" />,
        variant: 'destructive',
        onClick: () => handleDeletePrompt(contextMenu.prompt),
      },
    ];
  }, [contextMenu, flattenedFolders, folderPathById, t, toggleFavorite, togglePinned, handleViewDetail, handleCopyPrompt, handleDuplicatePrompt, handleSharePrompt, handleVersionHistory, handleDeletePrompt, handleMovePrompt]);

  useEffect(() => {
    setIsTagDropActive(false);
  }, [selectedId]);

  // Batch operations
  // 批量操作函数
  const handleBatchFavorite = async (ids: string[], favorite: boolean) => {
    for (const id of ids) {
      if (favorite) {
        const prompt = prompts.find(p => p.id === id);
        if (prompt && !prompt.isFavorite) {
          await toggleFavorite(id);
        }
      }
    }
    showToast(t('toast.batchFavorited'), 'success');
  };

  const handleBatchMove = async (ids: string[], folderId: string | undefined) => {
    for (const id of ids) {
      await updatePrompt(id, { folderId });
    }
    showToast(t('toast.batchMoved'), 'success');
  };

  const handleBatchDelete = async (ids: string[]) => {
    if (!confirm(t('prompt.confirmBatchDelete', { count: ids.length }))) {
      return;
    }
    for (const id of ids) {
      await deletePrompt(id);
    }
    showToast(t('toast.batchDeleted'), 'success');
  };

  // Memoize getViewClass to avoid re-creating the function on every render
  // 使用 useCallback 缓存 getViewClass，避免每次渲染都重新创建函数
  const getViewClass = useCallback((mode: ViewMode, layout: 'col' | 'row' = 'col') => {
    const isActive = viewMode === mode;
    const layoutClass = layout === 'col' ? 'flex flex-col' : 'flex overflow-hidden';
    return `absolute inset-0 ${layoutClass} transition-opacity ease-out ${
      isActive
        ? 'opacity-100 z-10 pointer-events-auto duration-base'
        : 'opacity-0 z-0 pointer-events-none duration-0'
    }`;
  }, [viewMode]);

  return (
    <main className="flex-1 relative overflow-hidden app-wallpaper-section">
      {/* Skill Mode */}
      {uiViewMode === 'skill' ? (
        <Suspense fallback={loadingFallback}>
          <SkillManager />
        </Suspense>
      ) : (
      <>
      {/* List view mode */}
      {/* 列表视图模式 */}
      <div
        className={getViewClass('list')}
      >


        {/* Top: sort + view switch */}
        {/* 顶部：排序 + 视图切换 */}
        <PromptListHeader count={sortedPrompts.length} />

        {/* Table view */}
        {/* 表格视图 */}
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={loadingFallback}>
            <PromptTableView
              prompts={sortedPrompts}
              highlightTerms={highlightTerms}
              onSelect={(id) => selectPrompt(id)}
              onToggleFavorite={toggleFavorite}
              onCopy={handleCopyPrompt}
              onEdit={(prompt) => setEditingPrompt(prompt)}
              onDelete={handleDeletePrompt}
              onVersionHistory={handleVersionHistory}
              onViewDetail={handleViewDetail}
              onBatchFavorite={handleBatchFavorite}
              onBatchMove={handleBatchMove}
              onBatchDelete={handleBatchDelete}
              onContextMenu={handleContextMenu}
            />
          </Suspense>
        </div>
      </div>

      {/* Gallery view */}
      {/* Gallery 视图 */}
      <div
        className={getViewClass('gallery')}
      >
        <PromptListHeader count={sortedPrompts.length} />
        {viewMode === 'gallery' && (
          <Suspense fallback={loadingFallback}>
            <PromptGalleryView
              prompts={visiblePrompts}
              highlightTerms={highlightTerms}
              onSelect={(id) => selectPrompt(id)}
              onToggleFavorite={toggleFavorite}
              onCopy={handleCopyPrompt}
              onEdit={(prompt) => setEditingPrompt(prompt)}
              onDelete={handleDeletePrompt}
              onVersionHistory={handleVersionHistory}
              onViewDetail={handleViewDetail}
              onContextMenu={handleContextMenu}
            />
          </Suspense>
        )}
      </div>

      {/* Kanban view */}
      {/* 看板视图 */}
      <div
        className={getViewClass('kanban')}
      >
        <PromptListHeader count={sortedPrompts.length} />
        {viewMode === 'kanban' && (
          <Suspense fallback={loadingFallback}>
            <PromptKanbanView
              prompts={visiblePrompts}
              highlightTerms={highlightTerms}
              onSelect={(id) => selectPrompt(id)}
              onToggleFavorite={toggleFavorite}
              onCopy={handleCopyPrompt}
              onEdit={(prompt) => setEditingPrompt(prompt)}
              onDelete={handleDeletePrompt}
              onVersionHistory={handleVersionHistory}
              onViewDetail={handleViewDetail}
              onContextMenu={handleContextMenu}
            />
          </Suspense>
        )}
      </div>

      {/* Card view mode: two-column layout */}
      {/* 卡片视图模式：左右分栏 */}
      <div
        className={getViewClass('card', 'row')}
      >
        {/* Prompt list */}
        <div
          className="prompt-list-pane relative w-[var(--prompt-list-pane-width)] shrink-0 border-r border-border flex flex-col bg-card/50"
          style={{ '--prompt-list-pane-width': `${promptListPaneWidth}px` } as CSSProperties}
        >
          {/* List header: sort + view switch */}
          {/* 列表头部：排序 + 视图切换 */}
          <PromptListHeader count={sortedPrompts.length} />

          {/* List content */}
          {/* 列表内容 */}
          {sortedPrompts.length === 0 ? (
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <SparklesIcon className="w-8 h-8 text-primary" />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">{t('prompt.noPrompts')}</p>
                <p className="text-sm text-muted-foreground">{t('prompt.addFirst')}</p>
              </div>
            </div>
          ) : (
            <VirtualizedPromptList
              prompts={visiblePrompts}
              selectedPromptIdSet={selectedPromptIdSet}
              highlightTerms={highlightTerms}
              onSelect={handleSelectPrompt}
              onContextMenu={handleContextMenu}
            />
          )}
          {/* Drag-to-resize handle for the prompt list pane (#119) */}
          {/* Prompt 列表栏的拖拽手柄 (#119) */}
          <div className="absolute inset-y-0 right-0 z-10 flex">
            <ColumnResizer
              currentWidth={promptListPaneWidth}
              min={PROMPT_LIST_PANE_WIDTH_MIN}
              max={PROMPT_LIST_PANE_WIDTH_MAX}
              defaultWidth={PROMPT_LIST_PANE_WIDTH_DEFAULT}
              onResize={setPromptListPaneWidth}
              ariaLabel={t('prompt.resizeListPaneAria', 'Resize prompt list')}
            />
          </div>
        </div>

        {/* Prompt details - iOS style */}
        {/* Prompt 详情 - iOS 风格 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedPrompt ? (
            <div key={selectedPrompt.id} className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-3 duration-base">
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-4">
                  {/* Title section */}
                  {/* 标题区域 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      {isDetailInlineEditing ? (
                        <input
                          ref={detailTitleInputRef}
                          aria-label={t('prompt.titleLabel')}
                          value={detailInlineDraft.title}
                          onChange={(event) => {
                            const nextTitle = event.target.value;
                            setDetailInlineDraft((prev) => ({
                              ...prev,
                              title: nextTitle,
                            }));
                          }}
                          onKeyDown={handleDetailInlineEditKeyDown}
                          placeholder={t('prompt.titlePlaceholder')}
                          className="h-12 w-full bg-transparent border-0 p-0 text-xl font-bold text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                        />
                      ) : (
                        <h2
                          onDoubleClick={() => openDetailInlineEdit('title')}
                          className="text-xl font-bold text-foreground mb-1 cursor-text"
                        >
                          {selectedPrompt.title}
                        </h2>
                      )}
                      {selectedPrompt.description && (
                        <p className="text-sm text-muted-foreground">{selectedPrompt.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleFavorite(selectedPrompt.id)}
                        className={`
                      p-2.5 rounded-xl transition-all duration-base
                      ${selectedPrompt.isFavorite
                            ? 'text-yellow-500 bg-yellow-500/10'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }
                      active:scale-press-in
                    `}
                      >
                        <StarIcon className={`w-5 h-5 ${selectedPrompt.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleSharePrompt(selectedPrompt)}
                        className={`p-2.5 rounded-xl transition-all duration-base ${shared ? 'text-green-500 bg-green-500/10' : 'text-muted-foreground hover:bg-accent hover:text-foreground'} active:scale-press-in`}
                        title={t('prompt.shareJSON', '分享为 JSON')}
                      >
                         {shared ? <CheckIcon className="w-5 h-5" /> : <Share2Icon className="w-5 h-5" />}
                      </button>
                      {isDetailInlineEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={cancelDetailInlineEdit}
                            disabled={isDetailInlineSaving}
                            className="flex items-center gap-2 h-10 px-3 rounded-xl app-wallpaper-surface-strong border border-border text-sm font-medium hover:bg-accent/60 disabled:opacity-50 transition-colors"
                          >
                            <XIcon className="w-4 h-4" />
                            <span>{t('common.cancel')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveDetailInlineEdit()}
                            disabled={!canSaveDetailInlineEdit}
                            className="flex items-center gap-2 h-10 px-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                          >
                            {isDetailInlineSaving ? (
                              <LoaderIcon className="w-4 h-4 animate-spin" />
                            ) : (
                              <SaveIcon className="w-4 h-4" />
                            )}
                            <span>{t('common.save')}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingPrompt(selectedPrompt)}
                          aria-label={t('prompt.editPrompt')}
                          title={t('prompt.editPrompt')}
                          className="p-2.5 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-base active:scale-press-in"
                        >
                          <EditIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  {/* 元信息 */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-3.5 h-3.5" />
                      {new Date(selectedPrompt.updatedAt).toLocaleString()}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-accent text-accent-foreground text-xs font-medium">
                      v{selectedPrompt.version}
                    </span>
                  </div>

                  {/* Images */}
                  {/* 图片 */}
                  {selectedPrompt.images && selectedPrompt.images.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-3">
                        {selectedPrompt.images.map((img, index) => (
                          <div key={index} className="rounded-lg overflow-hidden border border-border shadow-sm">
                            <LocalImage
                              src={img}
                              alt={`image-${index}`}
                              className="max-w-[160px] max-h-[160px] object-cover hover:scale-105 transition-transform duration-smooth cursor-pointer"
                              fallbackClassName="w-[160px] h-[120px]"
                              onClick={() => setPreviewImage(img)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prompt Type Badge / 类型标识 */}
                  <div className="mb-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm ${
                        (selectedPrompt.promptType || 'text') === 'image'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                      }`}>
                        {(selectedPrompt.promptType || 'text') === 'image'
                          ? <ImageIcon className="h-3 w-3" />
                          : <MessageSquareTextIcon className="h-3 w-3" />
                        }
                        {(selectedPrompt.promptType || 'text') === 'image'
                          ? t('prompt.typeImage', '绘图')
                          : t('prompt.typeText', '文本')
                        }
                      </span>
                    </div>

                    <div
                      data-testid="prompt-detail-tags-dropzone"
                      onDragOver={handleDetailTagDragOver}
                      onDrop={handleDetailTagDrop}
                      onDragLeave={handleDetailTagDragLeave}
                      className={`flex min-h-[2rem] flex-wrap items-center gap-1.5 rounded-xl transition-colors ${isTagDropActive
                        ? 'bg-primary/6 ring-2 ring-primary/20 ring-inset'
                        : ''
                      }`}
                    >
                      {selectedPrompt.tags.map((tag) => {
                        const isTagFiltered = filterTags.includes(tag);

                        return (
                          <span
                            key={tag}
                            className={`inline-flex max-w-full items-center rounded-full text-xs font-medium transition-colors ${isTagFiltered
                              ? 'bg-primary text-white'
                              : 'bg-accent text-accent-foreground'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleTagFilterClick(tag)}
                              title={t('prompt.filterByTag', 'Filter by tag')}
                              className={`inline-flex min-w-0 items-center gap-1 rounded-l-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${isTagFiltered
                                ? 'hover:bg-primary/90'
                                : 'hover:bg-primary hover:text-white'
                              }`}
                            >
                              <HashIcon className="h-3 w-3 shrink-0" />
                              <span className="max-w-[11rem] truncate">{tag}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDetailRemoveTag(tag)}
                              title={t('prompt.removeTag', 'Remove tag')}
                              aria-label={`${t('prompt.removeTag', 'Remove tag')}: ${tag}`}
                              className={`inline-flex items-center justify-center rounded-r-full py-1.5 pl-1 pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 ${isTagFiltered
                                ? 'text-white/85 hover:bg-primary/90 hover:text-white focus-visible:ring-primary-foreground/30'
                                : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/30'
                              }`}
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}

                      {selectedPrompt.tags.length === 0 && (
                        <div className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs text-muted-foreground">
                          <HashIcon className="h-3 w-3" />
                          <span>{t('prompt.selectExistingTags', 'Select existing tags')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Source / 来源 */}
                  {selectedPrompt.source && (
                    <div className="mb-4">
                      <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-1.5">
                        <GlobeIcon className="w-3.5 h-3.5" />
                        {t('prompt.source')}
                      </div>
                      <div className="text-sm rounded-xl p-3 app-wallpaper-surface border border-border break-all">
                        {selectedPrompt.source.startsWith('http') ? (
                          <a href={selectedPrompt.source} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 inline-flex">
                            <span className="truncate max-w-full">{selectedPrompt.source}</span>
                          </a>
                        ) : (
                          <span className="text-foreground/90">{selectedPrompt.source}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes / 备注 */}
                  {selectedPrompt.notes && (
                    <div className="mb-4">
                      <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-1.5">
                        {t('prompt.notes')}
                      </div>
                       <div className="text-sm bg-yellow-500/6 border border-yellow-500/12 rounded-xl p-3 text-foreground/80 italic">
                        {selectedPrompt.notes}
                      </div>
                    </div>
                  )}

                  {/* Language toggle button - hidden for English UI */}
                  {/* 语言切换按钮 - 英文界面时隐藏 */}
                  {(selectedPrompt.systemPromptEn || selectedPrompt.userPromptEn) && !i18n.language.startsWith('en') && (
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => setShowEnglish(!showEnglish)}
                        disabled={isDetailInlineEditing}
                        className={
                          `flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-base active:scale-press-in disabled:opacity-50 disabled:cursor-not-allowed ` +
                          (showEnglish
                            ? 'bg-primary text-white'
                            : 'bg-accent text-muted-foreground hover:text-foreground')
                        }
                        title={showEnglish ? t('prompt.showLocalized', '显示当前语言') : t('prompt.showEnglish')}
                        type="button"
                      >
                        <GlobeIcon className="w-3.5 h-3.5" />
                        {showEnglish ? 'EN' : uiLangTag}
                      </button>
                    </div>
                  )}

                  {/* System Prompt */}
                  {((showEnglish ? selectedPrompt.systemPromptEn : selectedPrompt.systemPrompt) || isDetailInlineEditing) && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          {t('prompt.systemPromptLabel', 'System Prompt')}
                          {showEnglish && <span className="px-1 py-0.5 rounded bg-primary/10 text-primary text-[10px]">EN</span>}
                        </span>
                      </div>
                      {isDetailInlineEditing ? (
                          <div className="p-4 rounded-xl app-wallpaper-surface border border-border">
                            <textarea
                              ref={detailSystemPromptTextareaRef}
                            aria-label={t('prompt.systemPromptLabel', 'System Prompt')}
                            value={detailInlineDraft.systemPrompt}
                            onChange={(event) => {
                              const nextSystemPrompt = event.target.value;
                              setDetailInlineDraft((prev) => ({
                                ...prev,
                                systemPrompt: nextSystemPrompt,
                              }));
                            }}
                            onKeyDown={(event) => {
                              const handled = handleMarkdownListKeyDown(
                                event,
                                detailInlineDraft.systemPrompt,
                                (newValue, cursorPos) => {
                                  setDetailInlineDraft((prev) => ({
                                    ...prev,
                                    systemPrompt: newValue,
                                  }));
                                  requestAnimationFrame(() => {
                                    detailSystemPromptTextareaRef.current?.setSelectionRange(cursorPos, cursorPos);
                                  });
                                },
                              );
                              if (handled) {
                                return;
                              }
                              handleDetailInlineEditKeyDown(event);
                            }}
                            className="w-full min-h-[120px] resize-none bg-transparent border-0 p-0 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                              rows={4}
                              spellCheck={false}
                            />
                        </div>
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={t('prompt.inlineEditSystemPromptAria', 'Double-click to edit system prompt')}
                          onDoubleClick={() => openDetailInlineEdit('systemPrompt')}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openDetailInlineEdit('systemPrompt');
                            }
                          }}
                          className="cursor-text rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          {renderPromptContent(showEnglish ? (selectedPrompt.systemPromptEn || '') : (selectedPrompt.systemPrompt || ''))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* User Prompt */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        {t('prompt.userPromptLabel', 'User Prompt')}
                        {showEnglish && <span className="px-1 py-0.5 rounded bg-primary/10 text-primary text-[10px]">EN</span>}
                      </span>
                      <button
                        type="button"
                        onClick={toggleRenderMarkdown}
                        disabled={isDetailInlineEditing}
                        className="text-[12px] px-3 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {renderMarkdownEnabled ? t('prompt.viewRaw', 'Show Plain Text') : t('prompt.viewMarkdown', 'Markdown')}
                      </button>
                    </div>
                    {isDetailInlineEditing ? (
                      <div className="p-4 rounded-xl app-wallpaper-surface border border-border">
                        <textarea
                          ref={detailUserPromptTextareaRef}
                          aria-label={t('prompt.userPromptLabel', 'User Prompt')}
                          value={detailInlineDraft.userPrompt}
                          onChange={(event) => {
                            const nextUserPrompt = event.target.value;
                            setDetailInlineDraft((prev) => ({
                              ...prev,
                              userPrompt: nextUserPrompt,
                            }));
                          }}
                          onKeyDown={(event) => {
                            const handled = handleMarkdownListKeyDown(
                              event,
                              detailInlineDraft.userPrompt,
                              (newValue, cursorPos) => {
                                setDetailInlineDraft((prev) => ({
                                  ...prev,
                                  userPrompt: newValue,
                                }));
                                requestAnimationFrame(() => {
                                  detailUserPromptTextareaRef.current?.setSelectionRange(cursorPos, cursorPos);
                                });
                              },
                            );
                            if (handled) {
                              return;
                            }
                            handleDetailInlineEditKeyDown(event);
                          }}
                          className="w-full min-h-[280px] resize-none bg-transparent border-0 p-0 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                          rows={12}
                          spellCheck={false}
                        />
                      </div>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={t('prompt.inlineEditUserPromptAria', 'Double-click to edit user prompt')}
                        onDoubleClick={() => openDetailInlineEdit('userPrompt')}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openDetailInlineEdit('userPrompt');
                          }
                        }}
                        className="cursor-text rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        {renderPromptContent(showEnglish ? (selectedPrompt.userPromptEn || selectedPrompt.userPrompt) : selectedPrompt.userPrompt)}
                      </div>
                    )}
                  </div>

                </div>
              </div>
              {/* Action buttons - sticky bottom */}
              {/* 操作按钮 - 固定底部 */}
              <div className="flex-shrink-0 border-t border-border app-wallpaper-panel-strong px-6 py-3">
                <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap">
                  <button
                    onClick={async () => {
                      // Select content based on language mode
                      // 根据语言模式选择内容
                      const currentUserPrompt = showEnglish ? (selectedPrompt.userPromptEn || selectedPrompt.userPrompt) : selectedPrompt.userPrompt;
                      const currentSystemPrompt = showEnglish ? (selectedPrompt.systemPromptEn || selectedPrompt.systemPrompt) : selectedPrompt.systemPrompt;

                      // Check variables (create a new regex per string to avoid global flag state)
                      // 检查是否有变量（为每个字符串创建新的正则实例，避免全局标志导致的状态问题）
                      const hasVariables =
                        /\{\{([^}]+)\}\}/.test(currentUserPrompt) ||
                        (currentSystemPrompt && /\{\{([^}]+)\}\}/.test(currentSystemPrompt));

                      if (hasVariables) {
                        setIsVariableModalOpen(true);
                      } else {
                        await navigator.clipboard.writeText(currentUserPrompt);
                        await incrementUsageCount(selectedPrompt.id);
                        setCopied(true);
                        showToast(t('toast.copied'), 'success', showCopyNotification);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    disabled={isDetailInlineEditing}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                    <span>{copied ? t('prompt.copied') : t('prompt.copy')}</span>
                  </button>
                  <button
                    onClick={() => handleVersionHistory(selectedPrompt)}
                    disabled={isDetailInlineEditing}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg app-wallpaper-surface-strong border border-border text-sm font-medium hover:bg-accent/60 disabled:opacity-50 transition-colors"
                  >
                    <HistoryIcon className="w-4 h-4" />
                    <span>{t('prompt.history')}</span>
                  </button>
                  <button
                    onClick={() => handleDeletePrompt(selectedPrompt)}
                    disabled={isDetailInlineEditing}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span>{t('prompt.delete')}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mb-4">
                <SparklesIcon className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p>{t('prompt.selectPrompt')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Shared modals */}
      {/* 共享弹窗 */}

      {/* Edit modal */}
      {/* 编辑弹窗 */}
      {editingPrompt && (
        <Suspense fallback={null}>
          <EditPromptModal
            isOpen={!!editingPrompt}
            onClose={() => setEditingPrompt(null)}
            prompt={editingPrompt}
          />
        </Suspense>
      )}

      {/* Detail modal (for List/Gallery view) */}
      {/* 查看详情弹窗 (用于 List/Gallery 视图) */}
      {isDetailModalOpen && (
        <Suspense fallback={null}>
          <PromptDetailModal
            isOpen={isDetailModalOpen}
            onClose={() => {
              setIsDetailModalOpen(false);
              setDetailPrompt(null);
            }}
            prompt={detailPrompt}
            onCopy={handleCopyPrompt}
            onEdit={(prompt) => setEditingPrompt(prompt)}
          />
        </Suspense>
      )}

      {/* Variable input modal (copy) - choose content by language mode */}
      {/* 变量输入弹窗（用于复制） - 根据语言模式选择内容 */}
      {selectedPrompt && (
        <Suspense fallback={null}>
          <VariableInputModal
            isOpen={isVariableModalOpen}
            onClose={() => setIsVariableModalOpen(false)}
            promptId={selectedPrompt.id}
            systemPrompt={showEnglish ? (selectedPrompt.systemPromptEn || selectedPrompt.systemPrompt) : selectedPrompt.systemPrompt}
            userPrompt={showEnglish ? (selectedPrompt.userPromptEn || selectedPrompt.userPrompt) : selectedPrompt.userPrompt}
            mode="copy"
            onCopy={async (text) => {
              await navigator.clipboard.writeText(text);
              await incrementUsageCount(selectedPrompt.id);
              setCopied(true);
              showToast(t('toast.copied'), 'success', showCopyNotification);
              setTimeout(() => setCopied(false), 2000);
              setIsVariableModalOpen(false);
            }}
          />
        </Suspense>
      )}

      {/* Variable input modal (copy from list/gallery view) */}
      {/* 变量输入弹窗（列表/画廊视图复制用） */}
      {copyPrompt && (
        <Suspense fallback={null}>
          <VariableInputModal
            isOpen={isCopyVariableModalOpen}
            onClose={() => {
              setIsCopyVariableModalOpen(false);
              setCopyPrompt(null);
            }}
            promptId={copyPrompt.id}
            systemPrompt={resolvePromptContentByLanguage(copyPrompt, showEnglish).systemPrompt}
            userPrompt={resolvePromptContentByLanguage(copyPrompt, showEnglish).userPrompt}
            mode="copy"
            onCopy={async (text) => {
              await navigator.clipboard.writeText(text);
              await incrementUsageCount(copyPrompt.id);
              setCopied(true);
              showToast(t('toast.copied'), 'success', showCopyNotification);
              setTimeout(() => setCopied(false), 2000);
              setIsCopyVariableModalOpen(false);
              setCopyPrompt(null);
            }}
          />
        </Suspense>
      )}

      {/* Version history modal (unified) */}
      {/* 版本历史弹窗 (Unified) */}
      {versionHistoryPrompt && (
        <Suspense fallback={null}>
          <VersionHistoryModal
            isOpen={isVersionModalOpenTable}
            onClose={() => {
              setIsVersionModalOpenTable(false);
              setVersionHistoryPrompt(null);
            }}
            prompt={versionHistoryPrompt}
            onRestore={handleRestoreVersionFromTable}
          />
        </Suspense>
      )}

      {/* Image preview modal */}
      {/* 图片预览弹窗 */}
      <ImagePreviewModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageSrc={previewImage}
      />

      {/* Delete confirm dialog */}
      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, prompt: null })}
        onConfirm={confirmDelete}
        title={t('prompt.delete')}
        message={t('prompt.confirmDeletePrompt')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        variant="destructive"
      />
      {/* Context menu */}
      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
      </>
      )}
    </main>
  );
}
