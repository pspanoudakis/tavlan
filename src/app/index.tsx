import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { requestWidgetUpdate, WidgetPreview } from 'react-native-android-widget';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/SegmentedControl';
import { SelectField } from '@/components/SelectField';
import { radius, spacing, useTheme } from '@/components/theme';
import { describeError } from '@/services/transport/errors';
import {
  DepartureEntry,
  StopOption,
  TransportTypeCode,
  TransportTypeOption,
} from '@/services/transport/genericTransportService';
import type { TransportProvider } from '@/services/transport/provider';
import { DEFAULT_PROVIDER_ID, getProvider, getService, TRANSPORT_PROVIDERS } from '@/services/transport/registry';
import * as Storage from '@/utils/storage';
import { formatUpdatedAt } from '@/widgets/common';
import { getBoard } from '@/widgets/registry';

/** Providers return stops in their own order; the picker wants them alphabetical. */
function byLocalisedName(locale: string) {
  return (a: StopOption, b: StopOption) => a.displayName.localeCompare(b.displayName, locale);
}

const BOARD_NAMES = [
  // Heights are generous on purpose: the boards fill their preview, so spare
  // room shows as background whereas too little would clip a departure row.
  { widgetName: 'ClassicBoard', label: 'Classic', previewHeight: 130 },
  { widgetName: 'ModernBoard', label: 'Modern', previewHeight: 205 },
] as const;

export default function Index() {
  const theme = useTheme();
  // The app draws edge to edge (edgeToEdgeEnabled=true, transparent system
  // bars), so with the header gone the content has to inset itself.
  const insets = useSafeAreaInsets();

  const [departures, setDepartures] = useState<DepartureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // Selections
  const [providerId, setProviderId] = useState(DEFAULT_PROVIDER_ID);
  const [transport, setTransport] = useState<TransportTypeCode>('');
  const [stationCode, setStationCode] = useState('');

  const provider = getProvider(providerId);
  const transportOptions: TransportTypeOption[] = getService(provider).getAvailableTransportOptions();

  // A transport code only means something to the provider that issued it, so
  // this is resolved first — everything below keys off the reconciled value.
  const effectiveTransport =
    transportOptions.some(o => o.typeCode === transport)
      ? transport
      : (transportOptions[0]?.typeCode ?? '');

  // Both lists are tagged with what they were loaded for, so a list left over
  // from a previous selection can never be read as the current one.
  const [loadedStops, setLoadedStops] = useState<{
    providerId: string;
    transport: TransportTypeCode;
    stops: StopOption[];
  } | null>(null);
  // Compared against `effectiveTransport`, which is what the loader tags the
  // list with. Comparing against the raw `transport` meant the tag could never
  // match whenever the two differed, leaving the picker loading forever.
  const stops =
    loadedStops?.providerId === providerId && loadedStops.transport === effectiveTransport
      ? loadedStops.stops
      : null;

  // Likewise a stop code: after switching provider or transport, the saved
  // station is usually not in the new list.
  const effectiveStation = stops?.length
    ? (stops.some(s => s.stopCode === stationCode) ? stationCode : stops[0].stopCode)
    : '';
  const currentStationLabel =
    stops?.find(s => s.stopCode === effectiveStation)?.displayName ?? '';

  // 1. Restore the saved provider, then its saved selection.
  useEffect(() => {
    async function initialize() {
      try {
        const saved = getProvider(await Storage.getStoredProviderId());
        setProviderId(saved.id);
        setTransport(await Storage.getStoredTransportType(saved));
        setStationCode(await Storage.getStoredStation(saved));
      } catch (e) {
        console.error('Failed to restore the saved selection:', e);
        setError(describeError(e, getProvider(null).strings.errors));
      } finally {
        setInitializing(false);
      }
    }
    initialize();
  }, []);

  // 2. Build the provider's catalogue, then load the stations for the transport.
  useEffect(() => {
    if (initializing || !effectiveTransport) return;

    let cancelled = false;
    async function loadStops() {
      try {
        const service = getService(provider);
        // The catalogue has to exist before any station list can be read from it.
        await service.init();
        const available = await service.getAvailableStops([effectiveTransport]);
        if (cancelled) return;
        setLoadedStops({
          providerId: provider.id,
          transport: effectiveTransport,
          stops: [...available].sort(byLocalisedName(provider.locale)),
        });
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to load stations:', e);
        // Record the empty result too, so the UI stops waiting on it.
        setLoadedStops({ providerId: provider.id, transport: effectiveTransport, stops: [] });
        setError(describeError(e, provider.strings.errors));
      }
    }
    loadStops();

    return () => { cancelled = true; };
  }, [provider, effectiveTransport, initializing]);

  // 3. Keep storage in step with what is actually shown. Changing provider or
  //    transport can move the selection on its own, and the widget reads storage
  //    — so these are the single places each value is persisted.
  useEffect(() => {
    if (initializing || !effectiveTransport) return;
    Storage.setTransportType(effectiveTransport).catch(e =>
      console.error('Failed to persist the selected transport:', e)
    );
  }, [effectiveTransport, initializing]);

  useEffect(() => {
    if (initializing || !effectiveStation) return;
    Storage.setStation(effectiveStation).catch(e =>
      console.error('Failed to persist the selected station:', e)
    );
  }, [effectiveStation, initializing]);

  // 4. Core Fetch & Widget Update Logic
  const fetchDeparturesAndRefreshWidgets = useCallback(async (
    activeProvider: TransportProvider,
    currentTransport: TransportTypeCode,
    currentStation: string,
    stationName: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const d = await getService(activeProvider)
        .getLiveDeparturesFromStop(currentStation, [currentTransport]);
      setDepartures(d);

      const fetchedAt = new Date();
      setUpdatedAt(fetchedAt);
      const boardProps = {
        stationName,
        transportType: currentTransport,
        departures: d,
        presentation: activeProvider,
        updatedAt: fetchedAt,
      };

      // Pushed in release builds too: the OS only refreshes a widget every 30
      // minutes, so without this a new selection would not reach the home screen
      // until long after it was made.
      for (const { widgetName } of BOARD_NAMES) {
        const Board = getBoard(activeProvider.id, widgetName);
        if (!Board) continue;
        requestWidgetUpdate({
          widgetName,
          renderWidget: () => <Board {...boardProps} />,
        });
      }
    } catch (e) {
      console.error("Error fetching data or updating widgets:", e);
      setDepartures([]);
      setError(describeError(e, activeProvider.strings.errors));
    } finally {
      setLoading(false);
    }
  }, []);

  // 5. Fetch once the selection has settled against the loaded station list.
  useEffect(() => {
    if (initializing || !stops || !effectiveStation) return;
    fetchDeparturesAndRefreshWidgets(
      provider, effectiveTransport, effectiveStation, currentStationLabel
    );
  }, [
    provider,
    effectiveTransport,
    effectiveStation,
    currentStationLabel,
    stops,
    initializing,
    fetchDeparturesAndRefreshWidgets,
  ]);

  const handleProviderChange = async (value: string) => {
    setProviderId(value);
    try {
      await Storage.setProviderId(value);
    } catch (e) {
      console.error('Failed to persist the selected provider:', e);
    }
  };

  const refresh = () => {
    if (!effectiveStation) return;
    fetchDeparturesAndRefreshWidgets(
      provider, effectiveTransport, effectiveStation, currentStationLabel
    );
  };

  if (initializing) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.mutedText, { color: theme.textMuted }]}>Starting up…</Text>
      </View>
    );
  }

  const showingPreview = !!stops && !loading;

  return (
    <>
      <StatusBar style="auto" />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Departures Board</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Choose what your home screen widget shows.
          </Text>
        </View>

        {/* Errors sit above the content rather than replacing it, so the
          * controls stay usable while something is wrong. */}
        {error && (
          <View style={[styles.banner, { backgroundColor: theme.dangerSurface, borderColor: theme.danger }]}>
            <Text style={[styles.bannerText, { color: theme.danger }]}>{error}</Text>
            <Pressable onPress={refresh} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.bannerAction, { color: theme.danger }]}>Retry</Text>
            </Pressable>
          </View>
        )}
        {/* Always rendered, including while SL is the only registered provider:
          * the selector is how provider switching is exercised, so hiding it
          * would leave that path unseen until a second operator existed. */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.textMuted }]}>OPERATOR</Text>
          {/* A dropdown rather than a segmented control: the operator is set
            * once and rarely revisited, so it does not earn the width that
            * transport does. */}
          <SelectField
            options={TRANSPORT_PROVIDERS.map(p => ({ value: p.id, label: p.displayName }))}
            value={providerId}
            onChange={handleProviderChange}
            placeholder="Operator"
            searchable={false}
          />
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.textMuted }]}>TRANSPORT</Text>
          {/* Labels come from the provider, in the provider's own language. */}
          <SegmentedControl
            segments={transportOptions.map(o => ({ value: o.typeCode, label: o.displayName }))}
            value={effectiveTransport}
            onChange={setTransport}
            accessibilityLabel="Transport type"
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.textMuted }]}>STATION</Text>
          <SelectField
            options={stops?.map(s => ({ value: s.stopCode, label: s.displayName })) ?? null}
            value={effectiveStation}
            onChange={setStationCode}
            placeholder="Select a station"
            loadingLabel="Loading stations…"
            emptyLabel="No stations available"
            searchPlaceholder="Search stations"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.previewHeader}>
            <Text style={[styles.label, { color: theme.textMuted }]}>PREVIEW</Text>
            <Pressable
              onPress={refresh}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Refresh departures"
              hitSlop={8}
              style={({ pressed }) => [{ opacity: pressed || loading ? 0.5 : 1 }]}
            >
              <Text style={[styles.refresh, { color: theme.accent }]}>
                {loading ? 'Refreshing…' : 'Refresh'}
              </Text>
            </Pressable>
          </View>

          {showingPreview ? (
            BOARD_NAMES.map(({ widgetName, label, previewHeight }) => {
              const Board = getBoard(provider.id, widgetName);
              if (!Board) return null;
              return (
                <View key={widgetName} style={styles.previewBlock}>
                  <Text style={[styles.previewLabel, { color: theme.textMuted }]}>{label}</Text>
                  <View style={[styles.previewFrame, { borderColor: theme.border, backgroundColor: theme.surfaceSunken }]}>
                    <WidgetPreview
                      renderWidget={() => (
                        <Board
                          stationName={currentStationLabel}
                          transportType={effectiveTransport}
                          departures={departures}
                          presentation={provider}
                          message={error ?? undefined}
                        />
                      )}
                      width={320}
                      height={previewHeight}
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <View style={[styles.previewPlaceholder, { backgroundColor: theme.surfaceSunken, borderColor: theme.border }]}>
              <ActivityIndicator size="small" color={theme.textMuted} />
              <Text style={[styles.mutedText, { color: theme.textMuted }]}>Loading departures…</Text>
            </View>
          )}

          {/* Same formatter the board header uses, so the app and the widget
            * never disagree about what time the data was read. */}
          {updatedAt && showingPreview && (
            <Text style={[styles.footnote, { color: theme.textMuted }]}>
              Updated {formatUpdatedAt(updatedAt, provider)}
              {' · '}Tap a widget on your home screen to refresh it
            </Text>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    // Vertical padding is applied at the call site, where the safe area insets
    // are known.
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  bannerAction: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refresh: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  previewBlock: {
    marginBottom: spacing.lg,
  },
  previewLabel: {
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  previewFrame: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    overflow: 'hidden',
  },
  previewPlaceholder: {
    height: 180,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  mutedText: {
    fontSize: 14,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
  },
});
