// Paragraph-level SelectableTextView - used by BibleContentRenderer
export { default as SelectableTextView } from './SelectableTextView';
export type {
  SelectableTextViewProps,
  SelectableTextEvent,
  SelectableTextAction,
  TextRangeHighlight,
  LineIndent,
} from './SelectableTextView';

// Chapter-level view - renders entire chapter as single selectable text block
export { default as ChapterSelectableText } from './ChapterSelectableText';
export type {
  ChapterSelectableTextProps,
  ChapterSelectionEvent,
  ChapterSelectableTextAction,
  ChapterContentSizeEvent,
  StyledSection,
  VerseHighlight,
} from './ChapterSelectableText';

// StyleSpec types and builder - all styling defined in React Native
export { buildStyleSpec, getBibleFontSize, DEFAULT_STYLE_SPEC } from './styleSpec';
export type { StyleSpec, TextStyle, FontWeight, FontStyle, TextAlign, SectionType } from './styleSpec';
