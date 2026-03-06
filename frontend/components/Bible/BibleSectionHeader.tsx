/**
 * Shared Bible Section Header Component
 * Used by SinglePaneBibleView and ChapterLevelBibleView for consistent section headers
 */

import React from 'react';
import { View, Text } from 'react-native';
import { type BibleStyles } from './BibleStyles';

interface BibleSectionHeaderProps {
  title?: string;
  subtitle?: string;
  styles: BibleStyles;
}

/**
 * Renders a styled section header with optional title and subtitle
 */
export const BibleSectionHeader: React.FC<BibleSectionHeaderProps> = ({
  title,
  subtitle,
  styles,
}) => {
  // Don't render if neither title nor subtitle exists
  if (!title && !subtitle) {
    return null;
  }

  return (
    <View style={styles.sectionHeader}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
};
