import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { ClassicBoardWidget } from './classicBoardWidget';
import { ModernBoardWidget } from './modernBoardWidget';

const nameToWidget = {
  // The widget name matches the Java class name or the configured name.
  ClassicBoard: ClassicBoardWidget,
  ModernBoard: ModernBoardWidget,
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget =
    nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

  switch (props.widgetAction) {
    case 'WIDGET_UPDATE':
    case 'WIDGET_ADDED':
    case 'WIDGET_RESIZED':
      // const slService = new SLService();
      // await slService.init()
      // const departures = await slService.getLiveDeparturesFromStop("9192", ["METRO"]);
      // console.log(departures);
      // props.renderWidget(
      //   <Widget
      //     stationName={'Tallkrogen'}
      //     transportType={'T-BANA'}
      //     departures={departures}
      //   />
      // );
    case 'WIDGET_DELETED':
      // Not needed for now
      break;
    case 'WIDGET_CLICK':
      // Not needed for now
      break;
    default:
      break;
  }
}