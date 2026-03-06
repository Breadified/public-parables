# expo-selectable-text

Native text view with custom context menu for Bible apps.

## Features

- Native text selection with blue highlight and drag handles
- Custom context menu: Copy, Share, Note, Highlight, Bookmark
- No native copy/paste menu
- Works on iOS 15.1+ and Android 6.0+

## Setup

This is a local Expo module. After adding it, you need to rebuild the native app:

```bash
# For iOS
npx expo run:ios

# For Android
npx expo run:android
```

## Usage

```tsx
import { SelectableTextView } from '@/modules/expo-selectable-text';

function VerseText({ text, verseId, onAction }) {
  return (
    <SelectableTextView
      text={text}
      verseId={verseId}
      fontSize={18}
      textColor="#1a1a1a"
      lineHeight={1.6}
      onAction={({ nativeEvent }) => {
        console.log(`Action: ${nativeEvent.action}`);
        console.log(`Selected: ${nativeEvent.selectedText}`);
        console.log(`Verse ID: ${nativeEvent.verseId}`);
        onAction(nativeEvent);
      }}
      style={{ flex: 1 }}
    />
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| text | string | The text content to display |
| verseId | number? | Optional verse ID for tracking |
| fontSize | number? | Font size in points (default: 17) |
| fontFamily | string? | Font family name |
| textColor | string? | Text color as hex (e.g., "#1a1a1a") |
| lineHeight | number? | Line height multiplier (default: 1.5) |
| onAction | function? | Callback when user selects an action |

## Action Event

The `onAction` callback receives an event with:

```typescript
interface SelectableTextEvent {
  action: 'copy' | 'share' | 'note' | 'highlight' | 'bookmark';
  selectedText: string;
  verseId?: number;
  selectionStart: number;
  selectionEnd: number;
}
```
