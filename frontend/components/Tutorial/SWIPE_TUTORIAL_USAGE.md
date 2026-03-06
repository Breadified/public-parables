# Swipe Tutorial Modal - Usage Guide

## Overview

The `SwipeTutorialModal` is a professional, delightful tutorial that teaches users about the tab swipe gesture in the Bible viewer. It matches the exact animation behavior from `BibleSwipeableViewer` (200ms duration, Easing.out(Easing.cubic)).

## Features

- **Realistic animation**: Mirrors actual swipe behavior with exact timing
- **Looping demonstration**: Continuously shows the swipe gesture
- **Hand indicator**: Appears on first cycle to guide users
- **Card depth effects**: Cards scale and fade to show depth
- **Theme-aware**: Respects light/dark/sepia themes
- **Professional design**: Clean, not over-the-top

## Installation

The component is already exported from the Tutorial module:

```typescript
import { SwipeTutorialModal } from '@/components/Tutorial';
```

## Basic Usage

```typescript
import React, { useState, useEffect } from 'react';
import { SwipeTutorialModal } from '@/components/Tutorial';
import AsyncStorage from '@react-native-async-storage/async-storage';

function YourComponent() {
  const [showSwipeTutorial, setShowSwipeTutorial] = useState(false);

  useEffect(() => {
    // Check if user has seen the tutorial
    checkSwipeTutorialStatus();
  }, []);

  const checkSwipeTutorialStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem('swipeTutorialCompleted');
      if (!completed) {
        // Show tutorial after a brief delay
        setTimeout(() => setShowSwipeTutorial(true), 500);
      }
    } catch (error) {
      console.log('Error checking tutorial status:', error);
    }
  };

  const handleTutorialDismiss = async () => {
    setShowSwipeTutorial(false);
    try {
      await AsyncStorage.setItem('swipeTutorialCompleted', 'true');
    } catch (error) {
      console.log('Error saving tutorial status:', error);
    }
  };

  return (
    <>
      {/* Your main content */}

      <SwipeTutorialModal
        visible={showSwipeTutorial}
        onDismiss={handleTutorialDismiss}
      />
    </>
  );
}
```

## Integration with Search Navigation

For the specific use case of showing the tutorial after search navigation:

```typescript
import React, { useState, useEffect } from 'react';
import { SwipeTutorialModal } from '@/components/Tutorial';
import AsyncStorage from '@react-native-async-storage/async-storage';

function BibleTabsScreen() {
  const [showSwipeTutorial, setShowSwipeTutorial] = useState(false);
  const [hasNavigatedFromSearch, setHasNavigatedFromSearch] = useState(false);

  // Check if this navigation came from search
  useEffect(() => {
    const checkNavigationSource = async () => {
      try {
        const fromSearch = await AsyncStorage.getItem('navigatedFromSearch');
        const tutorialCompleted = await AsyncStorage.getItem('swipeTutorialCompleted');

        if (fromSearch && !tutorialCompleted) {
          setHasNavigatedFromSearch(true);
          // Clear the flag
          await AsyncStorage.removeItem('navigatedFromSearch');
          // Show tutorial after brief delay
          setTimeout(() => setShowSwipeTutorial(true), 800);
        }
      } catch (error) {
        console.log('Error checking navigation source:', error);
      }
    };

    checkNavigationSource();
  }, []);

  const handleTutorialDismiss = async () => {
    setShowSwipeTutorial(false);
    try {
      await AsyncStorage.setItem('swipeTutorialCompleted', 'true');
    } catch (error) {
      console.log('Error saving tutorial status:', error);
    }
  };

  return (
    <>
      {/* Your Bible tabs UI */}

      <SwipeTutorialModal
        visible={showSwipeTutorial}
        onDismiss={handleTutorialDismiss}
      />
    </>
  );
}
```

## Setting the Navigation Flag (From Search Screen)

When navigating from the search screen to a Bible chapter:

```typescript
// In your search results component
const handleNavigateToVerse = async (bookId: number, chapter: number, verse: number) => {
  try {
    // Set flag that we're navigating from search
    await AsyncStorage.setItem('navigatedFromSearch', 'true');

    // Navigate to the verse
    // ... your navigation logic
  } catch (error) {
    console.log('Error setting navigation flag:', error);
  }
};
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `visible` | `boolean` | Yes | Controls modal visibility |
| `onDismiss` | `() => void` | Yes | Callback when user dismisses the modal |

## Animation Details

The tutorial uses the exact same animation parameters as `BibleSwipeableViewer`:

- **Duration**: 200ms
- **Easing**: `Easing.out(Easing.cubic)`
- **Swipe distance**: 30% of screen width
- **Loop timing**: 2.6 second cycle (swipe right → hold → swipe left → pause)

## AsyncStorage Keys

| Key | Value | Purpose |
|-----|-------|---------|
| `swipeTutorialCompleted` | `'true'` | Tracks if user has seen the tutorial |
| `navigatedFromSearch` | `'true'` | Temporary flag for post-search navigation |

## Customization

The component automatically adapts to:
- **Theme mode**: Light, dark, and sepia themes
- **Screen size**: Responsive design for different devices
- **Haptic feedback**: Built-in for user interactions

## Testing

To reset the tutorial for testing:

```typescript
// Clear tutorial completion status
await AsyncStorage.removeItem('swipeTutorialCompleted');

// Set navigation flag
await AsyncStorage.setItem('navigatedFromSearch', 'true');
```

## Performance Notes

- Uses `react-native-reanimated` for 60fps animations
- Minimal re-renders with memoized animations
- Automatic cleanup when modal is dismissed
- No memory leaks from infinite loops (properly managed)
