import type { Editor } from '@tiptap/core';
import {
  Bookmark,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  ChevronRight,
  Minus,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { NOTE_TEMPLATES } from '../noteTemplates';
import { getCustomTemplates } from '../customTemplateStore';

/** A block that can be inserted from the slash menu. */
export interface SlashItem {
  /** Stable identity for React keys (titles can collide across custom templates). */
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  keywords: string[];
  /** Groups the item under a labelled section in the menu (built-ins are ungrouped). */
  section?: string;
  /** Applied at the caret; the trigger text ("/query") is already removed. */
  command: (editor: Editor) => void;
}

const BLOCK_ITEMS: readonly Omit<SlashItem, 'key'>[] = [
  {
    title: 'Text',
    subtitle: 'Plain paragraph',
    icon: Type,
    keywords: ['text', 'paragraph', 'p'],
    command: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    title: 'Heading 1',
    subtitle: 'Big section heading',
    icon: Heading1,
    keywords: ['h1', 'title', 'heading'],
    command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    subtitle: 'Medium heading',
    icon: Heading2,
    keywords: ['h2', 'heading', 'subtitle'],
    command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    subtitle: 'Small heading',
    icon: Heading3,
    keywords: ['h3', 'heading'],
    command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet list',
    subtitle: 'Unordered list',
    icon: List,
    keywords: ['bullet', 'unordered', 'ul', 'list'],
    command: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Numbered list',
    subtitle: 'Ordered list',
    icon: ListOrdered,
    keywords: ['numbered', 'ordered', 'ol', 'list'],
    command: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    title: 'Task list',
    subtitle: 'Checkboxes',
    icon: ListChecks,
    keywords: ['task', 'todo', 'checkbox', 'check'],
    command: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    title: 'Quote',
    subtitle: 'Block quote',
    icon: Quote,
    keywords: ['quote', 'blockquote', 'citation'],
    command: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    title: 'Code block',
    subtitle: 'Monospaced code',
    icon: Code2,
    keywords: ['code', 'snippet', 'pre'],
    command: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Toggle',
    subtitle: 'Collapsible section',
    icon: ChevronRight,
    keywords: ['toggle', 'details', 'collapse', 'accordion', 'expand'],
    command: (e) => e.chain().focus().setDetails().run(),
  },
  {
    title: 'Divider',
    subtitle: 'Horizontal rule',
    icon: Minus,
    keywords: ['divider', 'hr', 'rule', 'separator', 'line'],
    command: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  // Ready-made note structures (meeting notes, journal, brief, weekly plan).
  ...NOTE_TEMPLATES.map((template) => ({
    title: template.title,
    subtitle: template.subtitle,
    icon: template.icon,
    keywords: template.keywords,
    command: (e: Editor) => e.chain().focus().insertContent(template.build()).run(),
  })),
];

/** The built-in blocks + templates, each given a stable key. */
export const SLASH_ITEMS: readonly SlashItem[] = BLOCK_ITEMS.map((item, index) => ({
  key: `block:${index}`,
  ...item,
}));

const YOUR_TEMPLATES_SECTION = 'Your templates';

/**
 * The user's saved templates as slash items, grouped under a distinct section
 * with the bookmark glyph. Read live from the module snapshot so a just-saved
 * template appears without rebuilding the editor. `insertContent` drops the
 * stored doc's blocks at the caret (see templateDocToBlocks).
 */
function customSlashItems(): SlashItem[] {
  return getCustomTemplates().map((template) => ({
    key: `custom:${template.id}`,
    title: template.title,
    subtitle: template.subtitle,
    icon: Bookmark,
    keywords: ['template', 'my', 'custom', ...template.title.toLowerCase().split(/\s+/)],
    section: YOUR_TEMPLATES_SECTION,
    command: (e: Editor) => e.chain().focus().insertContent(template.blocks).run(),
  }));
}

/** Built-ins followed by the user's custom templates — the one merged list. */
export function allSlashItems(): SlashItem[] {
  return [...SLASH_ITEMS, ...customSlashItems()];
}

/** Filter the merged menu by a query against each item's title + keywords. */
export function filterSlashItems(query: string): SlashItem[] {
  const all = allSlashItems();
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((keyword) => keyword.includes(q)),
  );
}
