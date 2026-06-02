import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WidgetPreview, requestWidgetUpdate } from 'react-native-android-widget';

import { ClassicBoardWidget } from '@/widgets/classicBoardWidget';
import { ModernBoardWidget } from '@/widgets/modernBoardWidget';

export default function Index() {
  // This will force the home screen widget to update whenever this screen re-renders (e.g. during Fast Refresh)
  useEffect(() => {
    if (__DEV__) {
      requestWidgetUpdate({
        widgetName: 'ClassicBoard',
        renderWidget: () => <ClassicBoardWidget />,
      });
      requestWidgetUpdate({
        widgetName: 'ModernBoard',
        renderWidget: () => <ModernBoardWidget />,
      });
    }
  });

  return (
    <View style={styles.container}>
      <WidgetPreview
        renderWidget={() => <ClassicBoardWidget />}
        width={320}
        height={200}
      />
      <WidgetPreview
        renderWidget={() => <ModernBoardWidget />}
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
