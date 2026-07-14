import type { Editor } from '@tiptap/core';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Minus,
  Type,
  type LucideIcon,
} from 'lucide-react';

/** A block that can be inserted from the slash menu. */
export interface SlashItem {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  keywords: string[];
  /** Applied at the caret; the trigger text ("/query") is already removed. */
  command: (editor: Editor) => void;
}

export const SLASH_ITEMS: readonly SlashItem[] = [
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
    title: 'Divider',
    subtitle: 'Horizontal rule',
    icon: Minus,
    keywords: ['divider', 'hr', 'rule', 'separator', 'line'],
    command: (e) => e.chain().focus().setHorizontalRule().run(),
  },
];

/** Filter the menu by a query against each item's title + keywords. */
export function filterSlashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SLASH_ITEMS];
  return SLASH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((keyword) => keyword.includes(q)),
  );
}
