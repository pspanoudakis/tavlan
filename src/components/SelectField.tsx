import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, spacing, useTheme } from './theme';

export type SelectOption = {
    value: string;
    label: string;
};

type Props = {
    options: SelectOption[] | null;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    emptyLabel?: string;
    loadingLabel?: string;
    searchPlaceholder?: string;
    /** Defaults to on once the list is long enough to be worth filtering. */
    searchable?: boolean;
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

/**
 * A dropdown that expands in place rather than opening a dialog.
 *
 * Android's native picker takes over the screen, which is heavy for a choice
 * made on one screen with the result visible right below it. Everything here
 * stays on the same surface, and the list scrolls with the page.
 */
export function SelectField({
    options,
    value,
    onChange,
    placeholder = 'Select',
    emptyLabel = 'Nothing available',
    loadingLabel = 'Loading…',
    searchPlaceholder = 'Search',
    searchable,
}: Props) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');

    const showSearch = searchable ?? (options ? options.length > 10 : false);
    const selected = options?.find(o => o.value === value);

    const matches = useMemo(() => {
        if (!options) return [];
        const needle = showSearch ? fold(query.trim()) : '';
        if (!needle) return options;
        return options.filter(o => fold(o.label).includes(needle));
    }, [options, query, showSearch]);

    const collapse = () => {
        setExpanded(false);
        setQuery('');
    };

    const choose = (next: string) => {
        onChange(next);
        collapse();
    };

    if (options === null) {
        return (
            <View style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ActivityIndicator size="small" color={theme.textMuted} />
                <Text style={[styles.value, { color: theme.textMuted }]}>{loadingLabel}</Text>
            </View>
        );
    }

    if (!options.length) {
        return (
            <View style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.value, { color: theme.textMuted }]}>{emptyLabel}</Text>
            </View>
        );
    }

    if (!expanded) {
        return (
            <Pressable
                onPress={() => { setQuery(''); setExpanded(true); }}
                accessibilityRole="button"
                accessibilityLabel={`${selected?.label ?? placeholder}. Tap to change.`}
                style={({ pressed }) => [
                    styles.field,
                    { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                ]}
            >
                <Text numberOfLines={1} style={[styles.value, styles.valueFilled, { color: theme.text }]}>
                    {selected?.label ?? placeholder}
                </Text>
                <Text style={[styles.chevron, { color: theme.textMuted }]}>▾</Text>
            </Pressable>
        );
    }

    return (
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                {showSearch ? (
                    <>
                        <Text style={[styles.searchIcon, { color: theme.textMuted }]}>⌕</Text>
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder={searchPlaceholder}
                            placeholderTextColor={theme.textMuted}
                            style={[styles.searchInput, { color: theme.text }]}
                            autoFocus
                            autoCorrect={false}
                            autoCapitalize="none"
                            returnKeyType="search"
                            accessibilityLabel={searchPlaceholder}
                        />
                    </>
                ) : (
                    <Text style={[styles.headerLabel, { color: theme.textMuted }]}>{placeholder}</Text>
                )}
                <Pressable onPress={collapse} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8}>
                    <Text style={[styles.cancel, { color: theme.accent }]}>Cancel</Text>
                </Pressable>
            </View>

            {matches.length === 0 ? (
                <Text style={[styles.noMatches, { color: theme.textMuted }]}>
                    Nothing matches “{query.trim()}”
                </Text>
            ) : (
                // Rendered inline rather than in its own scroll view: nesting one
                // scrollable inside another fights for the same gesture.
                matches.map((option, index) => {
                    const isSelected = option.value === value;
                    return (
                        <Pressable
                            key={option.value}
                            onPress={() => choose(option.value)}
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
                                {option.label}
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
    value: {
        flex: 1,
        fontSize: 16,
    },
    valueFilled: {
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        minHeight: 52,
    },
    headerLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.5,
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
