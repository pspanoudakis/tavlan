import { Picker } from '@react-native-picker/picker';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { WidgetPreview, requestWidgetUpdate } from 'react-native-android-widget';

import { AdditionalSLStopInfo, SLService } from '@/services/transport/SL/service';
import { DepartureEntry } from '@/services/transport/genericTransportService';
import * as Storage from '@/utils/storage';
import { ClassicBoardWidget } from '@/widgets/classicBoardWidget';
import { TransportType } from '@/widgets/common';
import { ModernBoardWidget } from '@/widgets/modernBoardWidget';

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

const slService = new SLService();

export default function Index() {
  const [departures, setDepartures] = useState<DepartureEntry<AdditionalSLStopInfo>[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  // Selections
  const [transport, setTransport] = useState<TransportType>('METRO');
  const [stationCode, setStationCode] = useState('9101');

  // Find current label for UI display context
  const currentStationLabel = STATION_OPTIONS[transport]?.find(s => s.value === stationCode)?.label || 'Välj station';

  // 1. Initialize selections on Mount
  useEffect(() => {
    async function loadSavedSelections() {
      try {
        const savedTransport = await Storage.getStoredTransportType();
        const savedStation = await Storage.getStoredStation();

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
      await slService.init();
      
      const d = await slService.getLiveDeparturesFromStop(currentStation, [currentTransport]);
      setDepartures(d);

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
  const handleTransportChange = async (value: TransportType) => {
    setTransport(value);
    
    const defaultStation = STATION_OPTIONS[value]?.[0]?.value || '';
    setStationCode(defaultStation);

    try {
      await Storage.setTransportType(value);
      await Storage.setStation(defaultStation);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStationChange = async (value: string) => {
    setStationCode(value);
    try {
      await Storage.setStation(value);
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
      <View style={styles.selectorWrapper}>
        <Text style={styles.label}>Transportmedel</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={transport}
            onValueChange={(itemValue) => handleTransportChange(itemValue)}
            dropdownIconColor="#495057"
          >
            {TRANSPORT_OPTIONS.map((option) => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Station</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={stationCode}
            onValueChange={(itemValue) => handleStationChange(itemValue)}
            dropdownIconColor="#495057"
          >
            {STATION_OPTIONS[transport]?.map((option) => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </Picker>
        </View>
      </View>
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
                transportType={transport}
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
                transportType={transport}
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