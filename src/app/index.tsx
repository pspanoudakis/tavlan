import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WidgetPreview, requestWidgetUpdate } from 'react-native-android-widget';

// Make sure to adjust this import to match your actual sqlite-kv-store package configuration
import Storage from 'expo-sqlite/kv-store';

import { AdditionalSLStopInfo, SLService } from '@/services/transport/SL/service';
import { DepartureEntry } from '@/services/transport/genericTransportService';
import { ClassicBoardWidget } from '@/widgets/classicBoardWidget';
import { TransportType } from '@/widgets/common';
import { ModernBoardWidget } from '@/widgets/modernBoardWidget';

// --- Static Configuration Data ---
const TRANSPORT_OPTIONS: { label: string; value: TransportType }[] = [
  { label: 'Tunnelbana', value: 'METRO' },
  { label: 'Pendeltåg', value: 'TRAIN' },
];

const STATION_OPTIONS: Record<string, { label: string; value: string }[]> = {
  'METRO': [
    { label: 'Hässelby Gård', value: '9101' },
    { label: 'Vällingby', value: '9102' },
    { label: 'T-Centralen', value: '9001' },
  ],
  'TRAIN': [
    { label: 'Rosersberg', value: '9501' },
    { label: 'Upplands Väsby', value: '9502' },
    { label: 'Solna', value: '9509' },
  ],
};

const STORAGE_KEYS = {
  TRANSPORT: 'selected_transport',
  STATION: 'selected_station',
};

export default function Index() {
  const [departures, setDepartures] = useState<DepartureEntry<AdditionalSLStopInfo>[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  // Selections
  const [transport, setTransport] = useState('METRO');
  const [stationCode, setStationCode] = useState('9101');

  // UI Dropdown Toggles
  const [showTransportDropdown, setShowTransportDropdown] = useState(false);
  const [showStationDropdown, setShowStationDropdown] = useState(false);

  // Find current labels for UI display
  const currentTransportLabel = TRANSPORT_OPTIONS.find(t => t.value === transport)?.label || transport;
  const currentStationLabel = STATION_OPTIONS[transport]?.find(s => s.value === stationCode)?.label || 'Välj station';

  // 1. Initialize selections from SQLite KV Store on Mount
  useEffect(() => {
    async function loadSavedSelections() {
      try {
        const savedTransport = await Storage.getItemAsync(STORAGE_KEYS.TRANSPORT);
        const savedStation = await Storage.getItemAsync(STORAGE_KEYS.STATION);

        if (savedTransport) setTransport(savedTransport);
        if (savedStation) setStationCode(savedStation);
      } catch (error) {
        console.error("Failed to load settings from SQLite store:", error);
      } finally {
        setInitializing(false);
      }
    }
    loadSavedSelections();
  }, []);

  // 2. Core Fetch & Widget Update Logic
  const fetchDeparturesAndRefreshWidgets = useCallback(async (currentTransport: string, currentStation: string) => {
    setLoading(true);
    try {
      const slService = new SLService();
      await slService.init();
      
      const d = await slService.getLiveDeparturesFromStop(currentStation, [currentTransport]);
      setDepartures(d);

      // Get the readable station name matching the code
      const stationName = STATION_OPTIONS[currentTransport]?.find(s => s.value === currentStation)?.label || 'Station';
      const transportLabel = currentTransport === 'METRO' ? 'METRO' : 'TRAIN';

      if (__DEV__) {
        requestWidgetUpdate({
          widgetName: 'ClassicBoard',
          renderWidget: () => (
            <ClassicBoardWidget
              stationName={stationName}
              transportType={transportLabel}
              departures={d}
            />
          ),
        });
        requestWidgetUpdate({
          widgetName: 'ModernBoard',
          renderWidget: () => (
            <ModernBoardWidget
              stationName={stationName}
              transportType={transportLabel}
              departures={d}
            />
          ),
        });
      }
    } catch (error) {
      console.error("Error fetching data or updating widgets:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. Trigger Data Fetch when selections change
  useEffect(() => {
    if (initializing) return;
    fetchDeparturesAndRefreshWidgets(transport, stationCode);
  }, [transport, stationCode, initializing, fetchDeparturesAndRefreshWidgets]);

  // 4. Persistence Update Handlers
  const handleTransportChange = async (value: string) => {
    setTransport(value);
    setShowTransportDropdown(false);
    
    // Default to the first available station for the selected transport type
    const defaultStation = STATION_OPTIONS[value]?.[0]?.value || '';
    setStationCode(defaultStation);

    try {
      await Storage.setItemAsync(STORAGE_KEYS.TRANSPORT, value);
      await Storage.setItemAsync(STORAGE_KEYS.STATION, defaultStation);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStationChange = async (value: string) => {
    setStationCode(value);
    setShowStationDropdown(false);

    try {
      await Storage.setItemAsync(STORAGE_KEYS.STATION, value);
    } catch (e) {
      console.error(e);
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
      
      {/* --- SELECTORS CONTAINER --- */}
      <View style={styles.selectorWrapper}>
        <Text style={styles.label}>Transportmedel</Text>
        <TouchableOpacity 
          style={styles.dropdownButton} 
          onPress={() => { setShowTransportDropdown(!showTransportDropdown); setShowStationDropdown(false); }}
        >
          <Text style={styles.dropdownButtonText}>{currentTransportLabel}</Text>
        </TouchableOpacity>
        {showTransportDropdown && (
          <View style={styles.dropdownList}>
            {TRANSPORT_OPTIONS.map((item) => (
              <TouchableOpacity 
                key={item.value} 
                style={styles.dropdownItem} 
                onPress={() => handleTransportChange(item.value)}
              >
                <Text style={item.value === transport ? styles.selectedItemText : styles.itemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Station</Text>
        <TouchableOpacity 
          style={styles.dropdownButton} 
          onPress={() => { setShowStationDropdown(!showStationDropdown); setShowTransportDropdown(false); }}
        >
          <Text style={styles.dropdownButtonText}>{currentStationLabel}</Text>
        </TouchableOpacity>
        {showStationDropdown && (
          <View style={styles.dropdownList}>
            {STATION_OPTIONS[transport]?.map((item) => (
              <TouchableOpacity 
                key={item.value} 
                style={styles.dropdownItem} 
                onPress={() => handleStationChange(item.value)}
              >
                <Text style={item.value === stationCode ? styles.selectedItemText : styles.itemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* --- PREVIEWS CONTAINER --- */}
      {loading ? (
        <View style={styles.loadingWrapper}>
          <Text>Loading live departures...</Text>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <WidgetPreview
            renderWidget={() => (
              <ClassicBoardWidget
                stationName={currentStationLabel}
                transportType={transport === 'METRO' ? 'METRO' : 'TRAIN'}
                departures={departures}
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
                transportType={transport === 'METRO' ? 'METRO' : 'TRAIN'}
                departures={departures}
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
    zIndex: 1000, // Keeps dropdown lists floating over lower elements
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 6,
    marginTop: 12,
  },
  dropdownButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#212529',
  },
  dropdownList: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  itemText: {
    fontSize: 16,
    color: '#495057',
  },
  selectedItemText: {
    fontSize: 16,
    color: '#007aff',
    fontWeight: '600',
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