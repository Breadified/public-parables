import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  StatusBar,
  Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BibleVersion } from '@/state/studyModeStore';

interface VersionSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelectVersion: (version: BibleVersion) => void;
  availableVersions: BibleVersion[];
  currentVersion?: string;
  excludeVersion?: string;
  title?: string;
}

// Animation constants
const ITEM_SPRING_CONFIG = {
  tension: 150,
  friction: 12,
  useNativeDriver: true,
};

const STAGGER_DELAY = 30; // milliseconds between each item animation

export const VersionSelector: React.FC<VersionSelectorProps> = ({
  visible,
  onClose,
  onSelectVersion,
  availableVersions,
  currentVersion,
  excludeVersion,
  title = 'Select Bible Version'
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const filteredVersions = availableVersions.filter(v =>
    v.id !== excludeVersion
  );

  // Group versions by language
  const versionsByLanguage = filteredVersions.reduce((acc, version) => {
    const lang = version.language;
    if (!acc[lang]) {
      acc[lang] = [];
    }
    acc[lang].push(version);
    return acc;
  }, {} as Record<string, BibleVersion[]>);

  // Language display names
  const languageNames: Record<string, string> = {
    en: 'English',
    lorem: 'Lorem Ipsum (Dev)',
  };

  // Create flat list with section headers - English first, then others alphabetically
  const sectionsData: { type: 'header' | 'version'; language?: string; version?: BibleVersion; key: string }[] = [];
  const languageOrder = ['en', ...Object.keys(versionsByLanguage).filter(lang => lang !== 'en').sort()];

  languageOrder.forEach(lang => {
    const versions = versionsByLanguage[lang];
    if (versions) {
      sectionsData.push({ type: 'header', language: lang, key: `header-${lang}` });
      versions.forEach(version => {
        sectionsData.push({ type: 'version', version, key: version.id });
      });
    }
  });

  // Animation values
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(50)).current;
  const itemAnimations = useRef<Map<string, Animated.Value>>(new Map()).current;
  const itemScales = useRef<Map<string, Animated.Value>>(new Map()).current;

  // Initialize animation values for each item
  availableVersions.forEach(version => {
    if (!itemAnimations.has(version.id)) {
      itemAnimations.set(version.id, new Animated.Value(0));
      itemScales.set(version.id, new Animated.Value(1));
    }
  });

  // Animate modal in/out
  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslateY, {
          toValue: 0,
          ...ITEM_SPRING_CONFIG,
        }),
      ]).start();

      // Stagger item animations
      filteredVersions.forEach((version, index) => {
        const animValue = itemAnimations.get(version.id);
        if (animValue) {
          setTimeout(() => {
            Animated.spring(animValue, {
              toValue: 1,
              ...ITEM_SPRING_CONFIG,
            }).start();
          }, index * STAGGER_DELAY);
        }
      });
    } else {
      // Reset animations when closing
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Reset item animations
      itemAnimations.forEach(anim => {
        anim.setValue(0);
      });
    }
  }, [visible]);

  const renderItem = ({ item }: { item: typeof sectionsData[0] }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={[
            styles.sectionHeaderText,
            { color: theme.colors.text.secondary }
          ]}>
            {languageNames[item.language || ''] || item.language}
          </Text>
        </View>
      );
    }

    const version = item.version!;
    const isSelected = version.id === currentVersion;
    const isAvailable = version.isDownloaded;
    const itemAnim = itemAnimations.get(version.id);
    const scaleAnim = itemScales.get(version.id);

    return (
      <Animated.View
        style={[
          styles.versionItem,
          {
            backgroundColor: isSelected
              ? theme.colors.interactive.button.background
              : 'transparent',
            opacity: itemAnim?.interpolate({
              inputRange: [0, 1],
              outputRange: [0, isAvailable ? 1 : 0.5],
            }) || (isAvailable ? 1 : 0.5),
            transform: [
              {
                translateX: itemAnim?.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }) || 0,
              },
              { scale: scaleAnim || 1 },
            ],
          }
        ]}
      >
        <Pressable
          onPress={() => {
            if (isAvailable) {
              // Animate selection
              if (scaleAnim) {
                Animated.sequence([
                  Animated.timing(scaleAnim, {
                    toValue: 0.95,
                    duration: 100,
                    useNativeDriver: true,
                  }),
                  Animated.spring(scaleAnim, {
                    toValue: 1.02,
                    ...ITEM_SPRING_CONFIG,
                  }),
                  Animated.spring(scaleAnim, {
                    toValue: 1,
                    ...ITEM_SPRING_CONFIG,
                  }),
                ]).start(() => {
                  onSelectVersion(version);
                  onClose();
                });
              } else {
                onSelectVersion(version);
                onClose();
              }
            }
          }}
          onPressIn={() => {
            if (isAvailable && scaleAnim) {
              Animated.spring(scaleAnim, {
                toValue: 0.98,
                ...ITEM_SPRING_CONFIG,
              }).start();
            }
          }}
          onPressOut={() => {
            if (isAvailable && scaleAnim) {
              Animated.spring(scaleAnim, {
                toValue: 1,
                ...ITEM_SPRING_CONFIG,
              }).start();
            }
          }}
          disabled={!isAvailable}
          style={styles.pressableContent}
        >
        <View style={styles.versionInfo}>
          <Text style={[
            styles.versionName,
            {
              color: isSelected
                ? theme.colors.interactive.button.icon
                : theme.colors.text.primary,
              fontWeight: isSelected ? '600' : '500'
            }
          ]}>
            {version.name}
          </Text>
          <Text style={[
            styles.versionAbbr,
            {
              color: isSelected
                ? theme.colors.interactive.button.icon
                : theme.colors.text.secondary
            }
          ]}>
            {version.abbreviation}
          </Text>
        </View>
        {isSelected && (
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={theme.colors.interactive.button.icon}
          />
        )}
        {!isAvailable && (
          <View style={styles.downloadBadge}>
            <Text style={[
              styles.downloadText,
              { color: theme.colors.text.muted }
            ]}>
              Coming Soon
            </Text>
          </View>
        )}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={[
        styles.fullScreenContainer,
        { backgroundColor: theme.colors.background.secondary }
      ]}>
        {/* Header with safe area padding */}
        <View style={[
          styles.modalHeader,
          {
            borderBottomColor: theme.colors.border,
            paddingTop: (insets.top || StatusBar.currentHeight || 20) + 16,
          }
        ]}>
          <Text style={[
            styles.modalTitle,
            { color: theme.colors.text.primary }
          ]}>
            {title}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons
              name="close"
              size={28}
              color={theme.colors.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* Version list */}
        <FlatList
          data={sectionsData}
          renderItem={renderItem}
          keyExtractor={item => item.key}
          contentContainerStyle={[
            styles.versionList,
            { paddingBottom: insets.bottom + 20 }
          ]}
          style={styles.listContainer}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },

  pressableContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },

  closeButton: {
    padding: 4,
  },

  listContainer: {
    flex: 1,
  },

  versionList: {
    paddingVertical: 8,
  },

  versionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18, // Increased for better touch targets
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    minHeight: 64, // Ensure minimum touch target height
  },

  versionInfo: {
    flex: 1,
  },

  versionName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },

  versionAbbr: {
    fontSize: 14,
  },

  downloadBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },

  downloadText: {
    fontSize: 12,
    fontWeight: '500',
  },

  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: 20,
  },

  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});