import { Picker } from '@react-native-picker/picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { requestWidgetUpdate, WidgetPreview } from 'react-native-android-widget';

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
import { ClassicBoardWidget } from '@/widgets/classicBoardWidget';
import { ModernBoardWidget } from '@/widgets/modernBoardWidget';

/** Providers return stops in their own order; the dropdown wants them alphabetical. */
function byLocalisedName(locale: string) {
  return (a: StopOption, b: StopOption) => a.displayName.localeCompare(b.displayName, locale);
}

export default function Index() {
  const [departures, setDepartures] = useState<DepartureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selections
  const [providerId, setProviderId] = useState(DEFAULT_PROVIDER_ID);
  const [transport, setTransport] = useState<TransportTypeCode>('');
  const [stationCode, setStationCode] = useState('');

  const provider = getProvider(providerId);
  const transportOptions: TransportTypeOption[] = getService(provider).getAvailableTransportOptions();

  // Both lists are tagged with what they were loaded for, so a list left over
  // from a previous selection can never be read as the current one.
  const [loadedStops, setLoadedStops] = useState<{
    providerId: string;
    transport: TransportTypeCode;
    stops: StopOption[];
  } | null>(null);
  const stops =
    loadedStops?.providerId === providerId && loadedStops.transport === transport
      ? loadedStops.stops
      : null;

  // A transport code only means something to the provider that issued it.
  const effectiveTransport =
    transportOptions.some(o => o.typeCode === transport)
      ? transport
      : (transportOptions[0]?.typeCode ?? '');

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

      const updatedAt = new Date();
      const boardProps = {
        stationName,
        transportType: currentTransport,
        departures: d,
        presentation: activeProvider,
        updatedAt,
      };

      // Pushed in release builds too: the OS only refreshes a widget every 30
      // minutes, so without this a new selection would not reach the home screen
      // until long after it was made.
      requestWidgetUpdate({
        widgetName: 'ClassicBoard',
        renderWidget: () => <ClassicBoardWidget {...boardProps} />,
      });
      requestWidgetUpdate({
        widgetName: 'ModernBoard',
        renderWidget: () => <ModernBoardWidget {...boardProps} />,
      });
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

  // 6. Selection handlers. Transport and station are persisted by the effects
  //    above, which see the reconciled values rather than the raw ones.
  const handleProviderChange = async (value: string) => {
    setProviderId(value);
    try {
      await Storage.setProviderId(value);
    } catch (e) {
      console.error('Failed to persist the selected provider:', e);
    }
  };

  if (initializing) {
    return (
      <View style={styles.container}>
        <Text>Initializing app settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.selectorWrapper}>
        {/* Only worth showing once there is a choice to make. */}
        {TRANSPORT_PROVIDERS.length > 1 && (
          <>
            <Text style={styles.label}>Operator</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={providerId}
                onValueChange={(itemValue) => handleProviderChange(itemValue)}
                dropdownIconColor="#495057"
              >
                {TRANSPORT_PROVIDERS.map((p) => (
                  <Picker.Item key={p.id} label={p.displayName} value={p.id} />
                ))}
              </Picker>
            </View>
          </>
        )}

        <Text style={styles.label}>Transportmedel</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={effectiveTransport}
            onValueChange={(itemValue) => setTransport(itemValue)}
            dropdownIconColor="#495057"
          >
            {/* Labels come from the provider, in the provider's own language. */}
            {transportOptions.map((option) => (
              <Picker.Item key={option.typeCode} label={option.displayName} value={option.typeCode} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Station</Text>
        <View style={styles.pickerContainer}>
          {stops === null ? (
            <View style={styles.pickerPlaceholder}>
              <ActivityIndicator size="small" color="#495057" />
              <Text style={styles.placeholderText}>Loading Stations...</Text>
            </View>
          ) : stops.length === 0 ? (
            <View style={styles.pickerPlaceholder}>
              <Text style={styles.placeholderText}>No stations found</Text>
            </View>
          ) : (
            <Picker
              selectedValue={effectiveStation}
              onValueChange={(itemValue) => setStationCode(itemValue)}
              dropdownIconColor="#495057"
            >
              {stops.map((stop) => (
                <Picker.Item
                  key={stop.stopCode}
                  label={stop.displayName}
                  value={stop.stopCode}
                />
              ))}
            </Picker>
          )}
        </View>
      </View>
      {/* `stops === null` covers the gap after switching provider or transport,
        * when the old station's departures are still in state but no longer apply. */}
      {loading || stops === null ? (
        <View style={styles.loadingWrapper}>
          <Text>Loading live departures...</Text>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <WidgetPreview
            renderWidget={() => (
              <ClassicBoardWidget
                stationName={currentStationLabel}
                transportType={effectiveTransport}
                departures={departures}
                presentation={provider}
                message={error ?? undefined}
              />
            )}
            width={320}
            height={200}
          />
          <View style={{ height: 20 }} />
          <WidgetPreview
            renderWidget={() => (
              <ModernBoardWidget
                stationName={currentStationLabel}
                transportType={effectiveTransport}
                departures={departures}
                presentation={provider}
                message={error ?? undefined}
              />
            )}
            width={320}
            height={200}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  selectorWrapper: {
    width: '100%',
    maxWidth: 340,
    marginBottom: 30,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 6,
    marginTop: 12,
  },
  pickerContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pickerPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    // Matches the height a Picker settles at, so the row does not jump on load.
    height: 50,
  },
  placeholderText: {
    color: '#6c757d',
  },
  loadingWrapper: {
    height: 420,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
