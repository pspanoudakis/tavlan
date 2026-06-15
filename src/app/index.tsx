import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WidgetPreview, requestWidgetUpdate } from 'react-native-android-widget';

import { AdditionalSLStopInfo, SLService } from '@/services/transport/SL/service';
import { DepartureEntry } from '@/services/transport/genericTransportService';
import { ClassicBoardWidget } from '@/widgets/classicBoardWidget';
import { ModernBoardWidget } from '@/widgets/modernBoardWidget';

export default function Index() {
  const [departures, setDepartures] = useState<DepartureEntry<AdditionalSLStopInfo>[]>([]);
  const [loading, setLoading] = useState(true);
  // This will force the home screen widget to update whenever this screen re-renders (e.g. during Fast Refresh)
  useEffect(() => {
    setLoading(true);
    const slService = new SLService();
    slService.init().then(() => {
        // slService.getAvailableStops(['METRO']).then(r => console.log(r.slice(0, 6)));
        slService.getLiveDeparturesFromStop("9101", ["METRO"]).then(
            d => {
              // console.log(d);
              setDepartures(d);
              if (__DEV__) {
                requestWidgetUpdate({
                  widgetName: 'ClassicBoard',
                  renderWidget: () => <ClassicBoardWidget
                    stationName={'Hässelby Gård'}
                    transportType={'T-BANA'}
                    departures={d}
                  />,
                });
                requestWidgetUpdate({
                  widgetName: 'ModernBoard',
                  renderWidget: () => <ModernBoardWidget
                    stationName={'Hässelby Gård'}
                    transportType={'T-BANA'}
                    departures={d}
                  />,
                });
              }
            }
        )
    }).finally(() => setLoading(false));
  }, []);

  return (
    loading ? <Text>Loading...</Text> :
    <View style={styles.container}>
      <WidgetPreview
        renderWidget={() => <ClassicBoardWidget
          stationName={'Hässelby Gård'}
          transportType={'T-BANA'}
          departures={departures}
        />}
        width={320}
        height={200}
      />
      <WidgetPreview
        renderWidget={() => <ModernBoardWidget
          stationName={'Hässelby Gård'}
          transportType={'T-BANA'}
          departures={departures}
        />}
        width={320}
        height={200}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
