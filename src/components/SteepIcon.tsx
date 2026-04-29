import React from 'react';
import { Users, Cpu, DollarSign, Leaf, Landmark, Scale } from 'lucide-react';
import { STEEPCategory, STEEP_COLORS, STEEP_COLORS_MUTED } from '../types';

// Lucide icon components for each STEEPE category
const STEEP_ICON_MAP: Record<STEEPCategory, React.ComponentType<{ style?: React.CSSProperties }>> = {
  social: Users,
  technological: Cpu,
  economic: DollarSign,
  environmental: Leaf,
  political: Landmark,
  ethical: Scale,
};

// Dark mode muted colors (deeper/richer versions of the light mode pastels)
const STEEP_COLORS_MUTED_DARK: Record<STEEPCategory, string> = {
  social: 'rgba(233,30,140,0.18)',
  technological: 'rgba(0,212,170,0.18)',
  economic: 'rgba(200,230,0,0.18)',
  environmental: 'rgba(34,197,94,0.18)',
  political: 'rgba(255,107,53,0.18)',
  ethical: 'rgba(124,92,252,0.18)',
};

// Solid dark-mode colors for floating elements (pills that overlap borders/edges)
// Pre-composited against dark card bg (#1a1a1a) so no bleed-through
const STEEP_COLORS_MUTED_DARK_SOLID: Record<STEEPCategory, string> = {
  social: '#3d1a2e',
  technological: '#1a3530',
  economic: '#32351a',
  environmental: '#1a2e1f',
  political: '#3a261a',
  ethical: '#2a1e42',
};

// Matching text colors for muted backgrounds (vivid but not as bright as the pure colors)
const STEEP_TEXT_COLORS: Record<STEEPCategory, string> = {
  social: '#c41874',
  technological: '#00a383',
  economic: '#8fa300',
  environmental: '#16a34a',
  political: '#d4551c',
  ethical: '#6344d9',
};

const STEEP_TEXT_COLORS_DARK: Record<STEEPCategory, string> = {
  social: '#f472b6',
  technological: '#34d399',
  economic: '#d4e157',
  environmental: '#4ade80',
  political: '#fb923c',
  ethical: '#a78bfa',
};

interface SteepIconProps {
  category: STEEPCategory;
  size?: number;
  style?: React.CSSProperties;
}

/** Renders the Lucide icon for a STEEPE category */
export function SteepIcon({ category, size = 14, style }: SteepIconProps) {
  const IconComponent = STEEP_ICON_MAP[category];
  return <IconComponent style={{ width: size, height: size, flexShrink: 0, ...style }} />;
}

/**
 * Returns the muted background color for a STEEPE category pill/badge.
 * Uses CSS custom property to detect dark mode.
 * For inline styles, pass isDark explicitly.
 */
export function getSteepMutedBg(category: STEEPCategory, isDark: boolean): string {
  return isDark ? STEEP_COLORS_MUTED_DARK[category] : STEEP_COLORS_MUTED[category];
}

/** Returns the text color to pair with the muted background */
export function getSteepTextColor(category: STEEPCategory, isDark: boolean): string {
  return isDark ? STEEP_TEXT_COLORS_DARK[category] : STEEP_TEXT_COLORS[category];
}

/**
 * Returns a solid (opaque) muted background for floating elements like pills
 * that overlap borders/edges. In light mode this is the same as getSteepMutedBg.
 * In dark mode it uses pre-composited solid colors to avoid bleed-through.
 */
export function getSteepMutedBgSolid(category: STEEPCategory, isDark: boolean): string {
  return isDark ? STEEP_COLORS_MUTED_DARK_SOLID[category] : STEEP_COLORS_MUTED[category];
}

export { STEEP_ICON_MAP, STEEP_COLORS_MUTED_DARK, STEEP_COLORS_MUTED_DARK_SOLID, STEEP_TEXT_COLORS, STEEP_TEXT_COLORS_DARK };
