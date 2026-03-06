/**
 * Bible Tabs List Component
 * Manages multiple Bible reading tabs with add/remove functionality
 */

import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { observer, useSelector } from "@legendapp/state/react";
import { Ionicons } from "@expo/vector-icons";
import { bibleStore$ } from "@/state/bibleStore";
import { bibleVersionStore$ } from "@/state/bibleVersionStore";
import { switchToTab, removeTab } from "@/modules/bible/tabManager";
import { getBookByName, getLocalizedBookName } from "@/modules/bible/bibleBookMappings";
import { useTheme } from "@/contexts/ThemeContext";
import { getSecondaryTextColor } from "@/utils/themeHelpers";

interface BibleTabsListProps {
  onAddPress?: () => void;
}

export const BibleTabsList = observer(({ onAddPress }: BibleTabsListProps) => {
  const { themeMode: theme } = useTheme();
  const tabs = useSelector(bibleStore$.tabs);
  const activeTabIndex = useSelector(bibleStore$.active_tab_index);
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);
  const scrollViewRef = useRef<ScrollView>(null);
  const tabPositions = useRef<{ [key: string]: { x: number; width: number } }>({});
  const [scrollX, setScrollX] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (scrollViewRef.current && tabs[activeTabIndex]) {
      const activeTabId = tabs[activeTabIndex].id;
      const activeTabPosition = tabPositions.current[activeTabId];

      if (activeTabPosition) {
        // Calculate scroll position to center the active tab (or show it fully)
        const { x: activeX, width: activeWidth } = activeTabPosition;

        // If active tab is near the end, scroll to show it with some padding
        // Otherwise, scroll to show both the active tab and the previous tab
        let scrollToX = 0;

        if (activeTabIndex === 0) {
          // First tab - scroll to beginning
          scrollToX = 0;
        } else if (containerWidth > 0 && activeX + activeWidth > contentWidth - 60) {
          // Active tab is near the end - scroll to show it with right padding
          scrollToX = Math.max(0, activeX - containerWidth + activeWidth + 60);
        } else {
          // Show previous tab for context
          const prevTabId = tabs[activeTabIndex - 1]?.id;
          const prevTabPosition = tabPositions.current[prevTabId];

          if (prevTabPosition) {
            // Scroll to show the entire previous tab
            scrollToX = Math.max(0, prevTabPosition.x - 10);
          } else {
            // Fallback: scroll to active tab with left padding
            scrollToX = Math.max(0, activeX - 10);
          }
        }

        scrollViewRef.current.scrollTo({
          x: scrollToX,
          y: 0,
          animated: true,
        });
      }
    }
  }, [activeTabIndex, tabs, containerWidth, contentWidth]);

  const handleTabLayout = useCallback((event: any, tabId: string) => {
    const { x, width } = event.nativeEvent.layout;
    tabPositions.current[tabId] = { x, width };
  }, []);

  const handleTabPress = useCallback((index: number) => {
    switchToTab(index);
  }, []);

  const handleTabClose = useCallback((e: any, index: number) => {
    e.stopPropagation();
    removeTab(index);
  }, []);

  const { theme: themeContext } = useTheme();

  // Show gradients when there's content to scroll
  const showLeftGradient = scrollX > 5;
  const showRightGradient = contentWidth > containerWidth &&
                            scrollX < contentWidth - containerWidth - 5;

  const handleScroll = useCallback((event: any) => {
    setScrollX(event.nativeEvent.contentOffset.x);
  }, []);

  const handleContentSizeChange = useCallback((width: number) => {
    setContentWidth(width);
  }, []);

  const handleLayout = useCallback((event: any) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  // Get localized tab title based on primary version's language
  const getLocalizedTabTitle = useCallback((tab: any): string => {
    const versionData = bibleVersionStore$.getVersionData(primaryVersion);
    const language = versionData?.language || 'en';

    // If language is not 'zh', just return the original title
    if (language !== 'zh') {
      return tab.title;
    }

    // For Chinese, localize the book name
    const bookName = tab.current_book_name;
    const chapterNumber = tab.current_chapter_number;

    if (!bookName || !chapterNumber) {
      return tab.title;
    }

    // Get book ID from English name and then get localized name
    const book = getBookByName(bookName);
    if (!book) {
      return tab.title;
    }

    const localizedName = getLocalizedBookName(book.id, language);
    return `${localizedName} ${chapterNumber}`;
  }, [primaryVersion]);

  return (
    <View style={styles.tabsContainer} onLayout={handleLayout}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
        style={styles.tabsScrollView}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={handleContentSizeChange}
      >
        {tabs.map((tab: any, index: number) => {
          const isActive = index === activeTabIndex;
          return (
            <TouchableOpacity
              key={tab.id}
              onLayout={(e) => handleTabLayout(e, tab.id)}
              style={[
                styles.tab,
                isActive && {
                  backgroundColor: themeContext.colors.interactive.button.background,
                  borderColor: themeContext.colors.interactive.button.background,
                },
                !isActive && {
                  backgroundColor: themeContext.colors.background.elevated,
                  borderColor: themeContext.colors.border,
                },
              ]}
              onPress={() => handleTabPress(index)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive && styles.activeTabText,
                  {
                    color: isActive
                      ? themeContext.colors.interactive.button.icon
                      : getSecondaryTextColor(theme),
                  },
                ]}
              >
                {getLocalizedTabTitle(tab)}
              </Text>
              {tabs.length > 1 && (
                <TouchableOpacity
                  style={styles.tabCloseButton}
                  onPress={(e) => handleTabClose(e, index)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text
                    style={[
                      styles.tabCloseText,
                      {
                        color: isActive
                          ? themeContext.colors.interactive.button.icon
                          : getSecondaryTextColor(theme)
                      },
                    ]}
                  >
                    ×
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
        {/* Add button to launch search modal */}
        {onAddPress && (
          <TouchableOpacity
            style={[
              styles.addButton,
              {
                backgroundColor: themeContext.colors.background.elevated,
                borderColor: themeContext.colors.border,
              },
            ]}
            onPress={onAddPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name="add"
              size={20}
              color={getSecondaryTextColor(theme)}
            />
          </TouchableOpacity>
        )}
      </ScrollView>
      {/* Left edge fade gradient */}
      {showLeftGradient && (
        <LinearGradient
          colors={[
            themeContext.colors.background.primary,
            `${themeContext.colors.background.primary}00`,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fadeGradientLeft}
          pointerEvents="none"
        />
      )}
      {/* Right edge fade gradient */}
      {showRightGradient && (
        <LinearGradient
          colors={[
            `${themeContext.colors.background.primary}00`,
            themeContext.colors.background.primary,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fadeGradientRight}
          pointerEvents="none"
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    position: "relative",
  },

  tabsScrollView: {
    flex: 1,
  },

  tabsContent: {
    paddingRight: 10,
    gap: 4,
  },

  fadeGradientLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 40,
  },

  fadeGradientRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
  },

  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },

  tabText: {
    fontSize: 14,
    fontWeight: "500",
    marginRight: 4,
  },

  activeTabText: {
    fontWeight: "600",
  },

  tabCloseButton: {
    marginLeft: 4,
    padding: 2,
  },

  tabCloseText: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 18,
  },

  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});