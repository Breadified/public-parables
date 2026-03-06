import React, { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { observer, useSelector } from "@legendapp/state/react";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Pressable, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useScrollContext } from "@/contexts/ScrollContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSyncInitialization } from "@/hooks/useSyncInitialization";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { useLoginBonus } from "@/hooks/useLoginBonus";
import { useDisplayName } from "@/hooks/useDisplayName";
import { authStore$ } from "@/state/bibleStore";
import AvatarWithLevel from "@/components/AvatarWithLevel";

// Minimal icon-only tab bar
const AnimatedTabBar = ({ state, descriptors, navigation }: any) => {
  const scrollContext = useScrollContext();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Get current user for avatar display
  const currentUser = useSelector(authStore$.user);
  const displayName = useDisplayName(currentUser?.id ?? "");

  // Create fallback SharedValue unconditionally (React Hooks rule)
  const fallbackTranslateY = useSharedValue(0);

  // Extract SharedValue early to avoid serialization warnings
  const tabBarTranslateY = scrollContext?.tabBarTranslateY ?? fallbackTranslateY;

  // Create animated style using extracted SharedValue
  const tabBarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarTranslateY.value }],
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: "transparent",
          paddingBottom: insets.bottom + 8, // Safe area bottom + 8px padding
        },
        tabBarAnimatedStyle,
      ]}
    >
      {/* Minimal floating container - icons only */}
      <View
        style={[
          styles.tabBarContent,
          {
            backgroundColor: theme.colors.background.elevated,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Skip hidden tabs
          if (options.href === null) return null;

          // Map route names to Ionicons
          const iconName = route.name === "index" ? "book-outline" :
                          route.name === "devotion" ? "chatbubble-ellipses-outline" :
                          route.name === "library" ? "bookmark-outline" :
                          route.name === "plans" ? "calendar-outline" :
                          route.name === "settings" ? "settings-outline" :
                          "ellipse-outline";

          // Settings tab shows user avatar with level badge
          const isSettingsTab = route.name === "settings";
          const showAvatar = isSettingsTab && currentUser?.id;

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={[
                styles.tabButton,
                isFocused && {
                  backgroundColor: theme.colors.interactive.button.background,
                },
              ]}
            >
              {showAvatar ? (
                <AvatarWithLevel
                  userId={currentUser.id}
                  displayName={displayName}
                  size={22}
                />
              ) : (
                <Ionicons
                  name={iconName as any}
                  size={22}
                  color={isFocused ? theme.colors.interactive.button.icon : theme.colors.text.muted}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    // paddingBottom is now set dynamically using safe area insets
    paddingTop: 6,
  },
  tabBarContent: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 2,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
});

export default observer(function TabLayout() {
  const router = useRouter();
  const { user, getUserProfile } = useUnifiedAuth();
  const isInAuthFlow = useSelector(authStore$.isInAuthFlow);

  // Track if we've already checked display name to avoid repeated checks
  const hasCheckedDisplayName = useRef(false);

  // 🔄 Initialize sync when authenticated
  // PERF FIX: Using lightweight hook that doesn't subscribe to tabs/notes state
  // This prevents re-renders when tab titles change during scrolling
  useSyncInitialization();

  // 🎮 Award daily login bonus (after 5s in app)
  useLoginBonus();

  // Check if authenticated user needs to set their display name
  // This handles existing users who haven't customized their display name yet
  useEffect(() => {
    // Skip if no user, already in auth flow, or already checked
    if (!user || isInAuthFlow || hasCheckedDisplayName.current) {
      return;
    }

    const checkDisplayName = async () => {
      try {
        const profile = await getUserProfile();

        // If user hasn't customized their display name, redirect to onboarding
        if (profile && profile.user_display_names?.is_customized === false) {
          if (__DEV__) {
            console.log('[TabLayout] Display name not customized, redirecting to setup');
          }
          hasCheckedDisplayName.current = true;
          router.replace("/auth/display-name");
          return;
        }

        // Mark as checked so we don't check again
        hasCheckedDisplayName.current = true;
      } catch (error) {
        // Don't block the user on error, just log it
        if (__DEV__) {
          console.error('[TabLayout] Error checking display name:', error);
        }
        hasCheckedDisplayName.current = true;
      }
    };

    checkDisplayName();
  }, [user, isInAuthFlow, getUserProfile, router]);

  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Reading",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="devotion"
        options={{
          title: "Devotion",
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: "Plans",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
        }}
      />
    </Tabs>
  );
});
