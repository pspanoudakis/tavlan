import type { StopOption } from '@/services/transport/genericTransportService';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, spacing, useTheme } from './theme';

type Props = {
    stops: StopOption[] | null;
    value: string;
    onChange: (stopCode: string) => void;
};

const canNormalise = typeof String.prototype.normalize === 'function';

/**
 * Lowercases and strips diacritics so a query typed on any keyboard matches.
 * Swedish treats å, ä and ö as distinct letters rather than accented vowels, so
 * this is only ever applied to matching — never to sorting or display.
 */
function fold(value: string) {
    const lower = value.toLowerCase();
    return canNormalise ? lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : lower;
}

export function StationPicker({ stops, value, onChange }: Props) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');

    const selected = stops?.find(s => s.stopCode === value);

    const matches = useMemo(() => {
        if (!stops) return [];
        const needle = fold(query.trim());
        if (!needle) return stops;
        return stops.filter(s => fold(s.displayName).includes(needle));
    }, [stops, query]);

    const open = () => {
        setQuery('');
        setExpanded(true);
    };

    const choose = (stopCode: string) => {
        onChange(stopCode);
        setExpanded(false);
        setQuery('');
    };

    if (stops === null) {
        return (
            <View style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ActivityIndicator size="small" color={theme.textMuted} />
                <Text style={[styles.fieldValue, { color: theme.textMuted }]}>Loading stations…</Text>
            </View>
        );
    }

    if (!stops.length) {
        return (
            <View style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.fieldValue, { color: theme.textMuted }]}>No stations available</Text>
            </View>
        );
    }

    if (!expanded) {
        return (
            <Pressable
                onPress={open}
                accessibilityRole="button"
                accessibilityLabel={`Station: ${selected?.displayName ?? 'none selected'}. Tap to change.`}
                style={({ pressed }) => [
                    styles.field,
                    {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        opacity: pressed ? 0.7 : 1,
                    },
                ]}
            >
                <Text numberOfLines={1} style={[styles.fieldValue, styles.fieldValueFilled, { color: theme.text }]}>
                    {selected?.displayName ?? 'Select a station'}
                </Text>
                <Text style={[styles.chevron, { color: theme.textMuted }]}>▾</Text>
            </Pressable>
        );
    }

    return (
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
            <View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.searchIcon, { color: theme.textMuted }]}>⌕</Text>
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search stations"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.searchInput, { color: theme.text }]}
                    autoFocus
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    accessibilityLabel="Search stations"
                />
                <Pressable
                    onPress={() => setExpanded(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    hitSlop={8}
                >
                    <Text style={[styles.cancel, { color: theme.accent }]}>Cancel</Text>
                </Pressable>
            </View>

            {matches.length === 0 ? (
                <Text style={[styles.noMatches, { color: theme.textMuted }]}>
                    No station matches “{query.trim()}”
                </Text>
            ) : (
                // Rendered inline rather than in its own scroll view: nesting one
                // scrollable inside another fights for the same gesture.
                matches.map((stop, index) => {
                    const isSelected = stop.stopCode === value;
                    return (
                        <Pressable
                            key={stop.stopCode}
                            onPress={() => choose(stop.stopCode)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            style={({ pressed }) => [
                                styles.row,
                                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                                pressed && { backgroundColor: theme.surfaceSunken },
                            ]}
                        >
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.rowLabel,
                                    { color: isSelected ? theme.accent : theme.text },
                                    isSelected && styles.rowLabelSelected,
                                ]}
                            >
                                {stop.displayName}
                            </Text>
                            {isSelected && <Text style={[styles.tick, { color: theme.accent }]}>✓</Text>}
                        </Pressable>
                    );
                })
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        minHeight: 52,
    },
    fieldValue: {
        flex: 1,
        fontSize: 16,
    },
    fieldValueFilled: {
        fontWeight: '600',
    },
    chevron: {
        fontSize: 16,
    },
    panel: {
        borderWidth: 1.5,
        borderRadius: radius.md,
        overflow: 'hidden',
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        minHeight: 52,
    },
    searchIcon: {
        fontSize: 18,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        paddingVertical: spacing.md,
    },
    cancel: {
        fontSize: 15,
        fontWeight: '600',
    },
    noMatches: {
        padding: spacing.lg,
        fontSize: 15,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md + 2,
    },
    rowLabel: {
        flex: 1,
        fontSize: 16,
    },
    rowLabelSelected: {
        fontWeight: '700',
    },
    tick: {
        fontSize: 16,
        fontWeight: '700',
    },
});
