/**
 * CheckmarkIcon - Custom checkmark with controllable stroke thickness
 * Uses react-native-svg for precise control over strokeWidth
 */

import React from "react";
import Svg, { Path } from "react-native-svg";

interface CheckmarkIconProps {
  /** Size of the icon (width and height) */
  size?: number;
  /** Stroke thickness */
  strokeWidth?: number;
  /** Icon color */
  color?: string;
}

const CheckmarkIcon = ({
  size = 24,
  strokeWidth = 3,
  color = "#ffffff",
}: CheckmarkIconProps) => {
  // Checkmark path designed for a 24x24 viewBox
  // Starts from bottom-left, goes to bottom-middle, then to top-right
  const checkmarkPath = "M4 12.5L9.5 18L20 6";

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Path
        d={checkmarkPath}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default CheckmarkIcon;
