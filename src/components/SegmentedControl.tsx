import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, useTheme } from './theme';

export type Segment<T extends string> = {
    value: T;
    label: string;
};

type Props<T extends string> = {
    segments: Segment<T>[];
    value: T;
    onChange: (value: T) => void;
    accessibilityLabel?: string;
};

/**
 * An inline replacement for a two- or three-option dropdown.
 *
 * A dropdown on Android opens a modal dialog, which is a lot of ceremony for a
 * choice this small — here every option is visible and one tap away.
 */
export function SegmentedControl<T extends string>({
    segments,
    value,
    onChange,
    accessibilityLabel,
}: Props<T>) {
    const theme = useTheme();
    const [trackWidth, setTrackWidth] = useState(0);
    const selectedIndex = Math.max(0, segments.findIndex(s => s.value === value));

    // The thumb slides between equally-wide segments, so its offset is derived
    // from the measured track rather than from each segment's own layout.
    const segmentWidth = trackWidth ? trackWidth / segments.length : 0;
    const offset = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!segmentWidth) return;
        Animated.spring(offset, {
            toValue: selectedIndex * segmentWidth,
            useNativeDriver: true,
            speed: 20,
            bounciness: 4,
        }).start();
    }, [selectedIndex, segmentWidth, offset]);

    const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

    return (
        <View
            style={[styles.track, { backgroundColor: theme.surfaceSunken, borderColor: theme.border }]}
            onLayout={onLayout}
            accessibilityRole="tablist"
            accessibilityLabel={accessibilityLabel}
        >
            {/* Hidden until measured, so it never flashes at the wrong position. */}
            {segmentWidth > 0 && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.thumb,
                        {
                            width: segmentWidth - 4,
                            backgroundColor: theme.surfaceRaised,
                            borderColor: theme.border,
                            transform: [{ translateX: offset }],
                        },
                    ]}
                />
            )}

            {segments.map(segment => {
                const selected = segment.value === value;
                return (
                    <Pressable
                        key={segment.value}
                        style={styles.segment}
                        onPress={() => onChange(segment.value)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={segment.label}
                    >
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.segmentLabel,
                                { color: selected ? theme.text : theme.textMuted },
                                selected && styles.segmentLabelSelected,
                            ]}
                        >
                            {segment.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        flexDirection: 'row',
        borderRadius: radius.md,
        borderWidth: 1,
        padding: 2,
        position: 'relative',
    },
    thumb: {
        position: 'absolute',
        top: 2,
        left: 2,
        bottom: 2,
        borderRadius: radius.sm + 2,
        borderWidth: 1,
        // Keeps the raised segment legible against the sunken track.
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
    },
    segment: {
        flex: 1,
        paddingVertical: spacing.sm + 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    segmentLabelSelected: {
        fontWeight: '700',
    },
});
