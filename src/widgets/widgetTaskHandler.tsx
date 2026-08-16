import { describeError, messageOf } from '@/services/transport/errors';
import type { TransportProvider } from '@/services/transport/provider';
import { getProvider, getService } from '@/services/transport/registry';
import * as Storage from '@/utils/storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { BoardProps, REFRESH_CLICK_ACTION } from './common';
import { getBoard } from './registry';

/**
 * Reads the saved selection and the departures for it.
 *
 * Everything that can fail lives here, so the handler below is left with a
 * single place to catch — the previous version had none, and a rejected fetch
 * meant `renderWidget` was never reached and the widget kept a stale frame or
 * stayed blank.
 */
async function loadBoard(provider: TransportProvider): Promise<BoardProps> {
  const transportType = await Storage.getStoredTransportType(provider);
  const stopCode = await Storage.getStoredStation(provider);

  const service = getService(provider);
  await service.init();

  const [departures, stationName] = await Promise.all([
    service.getLiveDeparturesFromStop(stopCode, [transportType]),
    // The name is decoration; a board with real departures should still render
    // if only the cache lookup goes wrong.
    service.getStopNameByCode(stopCode).catch(e => {
      console.warn('[departures-widget] could not resolve stop name:', messageOf(e));
      return undefined;
    }),
  ]);

  return {
    transportType,
    stationName: stationName ?? '',
    departures,
    presentation: provider,
    updatedAt: new Date(),
  };
}

/**
 * A board that still identifies the stop where possible, so a failure reads as
 * "this station could not be refreshed" rather than as an empty widget.
 */
async function describeFailure(
  provider: TransportProvider,
  error: unknown
): Promise<BoardProps> {
  console.error('[departures-widget] could not render board:', messageOf(error), error);

  // The selection is read from local storage, so it is usually still available
  // even when the network or the stop cache is not.
  let transportType = provider.defaultTransportType;
  let stationName = '';
  try {
    transportType = await Storage.getStoredTransportType(provider);
    stationName = (await getService(provider).getStopNameByCode(
      await Storage.getStoredStation(provider)
    )) ?? '';
  } catch (e) {
    console.warn('[departures-widget] could not recover saved selection:', messageOf(e));
  }

  return {
    transportType,
    stationName,
    departures: [],
    presentation: provider,
    message: describeError(error, provider.strings.errors),
  };
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;

  const shouldRefresh =
    props.widgetAction === 'WIDGET_UPDATE' ||
    props.widgetAction === 'WIDGET_ADDED' ||
    props.widgetAction === 'WIDGET_RESIZED' ||
    // Tapping a board is the only way to refresh between the OS's 30 minute updates.
    (props.widgetAction === 'WIDGET_CLICK' && props.clickAction === REFRESH_CLICK_ACTION);

  if (!shouldRefresh) return;

  const provider = getProvider(await Storage.getStoredProviderId().catch(() => null));

  // Which design to draw depends on the selected operator, so the provider has
  // to be resolved before the board component can be looked up.
  const Board = getBoard(provider.id, widgetInfo.widgetName);
  if (!Board) {
    console.warn(`[departures-widget] unknown widget "${widgetInfo.widgetName}"`);
    return;
  }

  let board: BoardProps;
  try {
    board = await loadBoard(provider);
  } catch (error) {
    board = await describeFailure(provider, error);
  }

  // The height arrives with every action, including WIDGET_RESIZED, which is how
  // stretching the widget turns into more departure rows.
  props.renderWidget(<Board {...board} heightDp={widgetInfo.height} />);
}
