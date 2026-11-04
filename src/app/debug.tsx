import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/components/theme';
import { messageOf } from '@/services/transport/errors';
import * as Journal from '@/utils/refreshJournal';

const ACTIONS = ['on', 'off', 'status', 'print', 'clear'] as const;
type Action = (typeof ACTIONS)[number];

async function run(action: Action): Promise<string> {
  switch (action) {
    case 'on':
    case 'off':
      await Journal.setEnabled(action === 'on');
      break;
    case 'clear':
      await Journal.clear();
      break;
    case 'print':
      return `printed ${await Journal.print()} rows to logcat`;
  }
  const { enabled, rows } = await Journal.status();
  return `${enabled ? 'on' : 'off'}, ${rows} rows`;
}

/**
 * Reached only by link, e.g. `tavlan://debug?journal=on&n=1`; see
 * `@/utils/refreshJournal` for the actions. The result is shown here and logged,
 * so a script can read it without looking at the screen.
 */
export default function Debug() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // `n` only has to differ between requests: opening the same link while this
  // screen is up would otherwise leave the params, and so the effect, unchanged.
  const { journal, n } = useLocalSearchParams<{ journal?: string; n?: string }>();
  const [result, setResult] = useState('…');

  useEffect(() => {
    const action = ACTIONS.find(a => a === journal) ?? 'status';
    let cancelled = false;
    run(action).then(
      text => `journal ${action}: ${text}`,
      e => `journal ${action} failed: ${messageOf(e)}`
    ).then(text => {
      // Tagged with `n`, so a script can tell its own result from an earlier one.
      console.log(`[journal] result ${n ?? '-'} ${text}`);
      if (!cancelled) setResult(text);
    });
    return () => { cancelled = true; };
  }, [journal, n]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top + spacing.xl }]}>
      <Text style={[styles.title, { color: theme.text }]}>Diagnostics</Text>
      <Text style={[styles.result, { color: theme.textMuted }]}>{result}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/')}
        style={[styles.button, { backgroundColor: theme.accent }]}
      >
        <Text style={{ color: theme.onAccent }}>Back to Tavlan</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl, gap: spacing.lg },
  title: { fontSize: 22, fontWeight: '600' },
  result: { fontSize: 16 },
  button: { alignSelf: 'flex-start', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.sm },
});
