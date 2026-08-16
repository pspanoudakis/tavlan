import { DEFAULT_PROVIDER_ID } from '@/services/transport/registry';
import type { BoardProps } from './common';
import { ClassicBoardWidget } from './SL/classicBoardWidget';
import { ModernBoardWidget } from './SL/modernBoardWidget';

export type Board = (props: BoardProps) => React.JSX.Element;

/**
 * Board designs are drawn in an operator's own livery — SL's boards use SL
 * Gothic and SL's blue and yellow signage colours — so each provider ships its
 * own set rather than sharing one themed component.
 *
 * The keys are the widget names declared in `app.json`, which are global to the
 * app: placing "Classic Departures Board" renders it in whichever operator the
 * user has selected.
 */
// Both levels are keyed by arbitrary strings — a provider id from storage, a
// widget name from Android — so both lookups are spelled as possibly missing.
const BOARDS_BY_PROVIDER: Record<string, Record<string, Board | undefined> | undefined> = {
    SL: {
        ClassicBoard: ClassicBoardWidget,
        ModernBoard: ModernBoardWidget,
    },
};

/**
 * The board a provider draws for a given widget name, falling back to the
 * default provider's so that an operator shipping only one design still renders
 * something rather than nothing.
 */
export function getBoard(providerId: string, widgetName: string): Board | undefined {
    const own = BOARDS_BY_PROVIDER[providerId]?.[widgetName];
    if (own) return own;

    const fallback = BOARDS_BY_PROVIDER[DEFAULT_PROVIDER_ID]?.[widgetName];
    if (fallback) {
        console.warn(
            `Provider "${providerId}" has no "${widgetName}" board; using ${DEFAULT_PROVIDER_ID}'s.`
        );
    }
    return fallback;
}
