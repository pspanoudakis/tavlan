import { useColorScheme } from 'react-native';

/**
 * App chrome is deliberately English while anything naming a service — the
 * transport modes, the board copy — comes from the provider in its own
 * language. Mixing the two was what made the old screen read as half-translated.
 */
export type Palette = {
    background: string;
    surface: string;
    surfaceRaised: string;
    surfaceSunken: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    onAccent: string;
    danger: string;
    dangerSurface: string;
};

const light: Palette = {
    background: '#f2f4f7',
    surface: '#ffffff',
    surfaceRaised: '#ffffff',
    surfaceSunken: '#e7eaf0',
    border: '#d9dee7',
    text: '#10131a',
    textMuted: '#5c6472',
    accent: '#1c5fd0',
    onAccent: '#ffffff',
    danger: '#a8202a',
    dangerSurface: '#fdecec',
};

const dark: Palette = {
    background: '#0a0c11',
    surface: '#141821',
    surfaceRaised: '#1c222d',
    surfaceSunken: '#0f131a',
    border: '#28303d',
    text: '#eef1f6',
    textMuted: '#949daf',
    accent: '#5c9bff',
    onAccent: '#07101f',
    danger: '#ff7b7b',
    dangerSurface: '#2a1416',
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
} as const;

export const radius = {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
} as const;

export function useTheme(): Palette {
    return useColorScheme() === 'dark' ? dark : light;
}
