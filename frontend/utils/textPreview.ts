/**
 * Utility functions for generating text previews from note content
 */

export interface TextPreviewResult {
  preview: string;
  hasMore: boolean;
}

/**
 * Extracts a preview from text content, truncating at word boundaries
 *
 * @param content - The full text content
 * @param maxLines - Maximum number of lines to include in preview (default: 3)
 * @param maxCharsPerLine - Maximum characters per line before truncation (default: 60)
 * @returns Preview text and flag indicating if there's more content
 */
export function getTextPreview(
  content: string,
  maxLines: number = 3,
  maxCharsPerLine: number = 60
): TextPreviewResult {
  if (!content || content.trim() === '') {
    return { preview: '', hasMore: false };
  }

  const lines = content.split('\n').filter(line => line.trim() !== '');

  // If content has fewer lines than max, show all of it
  if (lines.length <= maxLines) {
    return {
      preview: lines.join('\n'),
      hasMore: false
    };
  }

  // Take first maxLines
  const previewLines = lines.slice(0, maxLines);

  // Truncate the last line if it's too long, at word boundary
  const lastLineIndex = maxLines - 1;
  if (previewLines[lastLineIndex] && previewLines[lastLineIndex].length > maxCharsPerLine) {
    const lastLine = previewLines[lastLineIndex];
    const truncated = lastLine.slice(0, maxCharsPerLine);
    // Find last space to avoid cutting mid-word
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxCharsPerLine * 0.7) { // Only use word boundary if it's not too far back
      previewLines[lastLineIndex] = truncated.slice(0, lastSpace);
    } else {
      previewLines[lastLineIndex] = truncated;
    }
  }

  return {
    preview: previewLines.join('\n'),
    hasMore: true
  };
}

/**
 * Calculates the height needed for preview text
 *
 * @param preview - The preview text
 * @param lineHeight - Height per line in pixels
 * @returns Estimated height in pixels
 */
export function calculatePreviewHeight(preview: string, lineHeight: number = 22): number {
  const lines = preview.split('\n').length;
  return lines * lineHeight;
}
