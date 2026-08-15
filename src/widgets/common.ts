import type { DepartureEntry, TransportTypeCode } from "@/services/transport/genericTransportService";
import type { BoardPresentation } from "@/services/transport/provider";

/**
 * Emitted when a board is tapped, and handled in the widget task handler.
 * Android caps automatic updates at one every 30 minutes, so this is the only
 * way for someone to pull fresh departures on demand.
 */
export const REFRESH_CLICK_ACTION = 'REFRESH_DEPARTURES';

export interface BoardProps {
    /** A code from the active provider's own set, not a fixed union. */
    transportType: TransportTypeCode
    stationName: string,
    /**
     * Boards read only the fields every provider supplies, so the provider's own
     * `additionalInfo` shape stays out of the widget layer entirely.
     */
    departures: DepartureEntry[]
    /** Copy, locale and branding for whichever operator produced the departures. */
    presentation: BoardPresentation
    /**
     * Shown in place of the departure rows when there is nothing to display.
     * A board with neither departures nor a message would render as a blank
     * rectangle, so callers should always supply one of the two.
     */
    message?: string
    /** When the departures were fetched, shown so stale data is recognisable. */
    updatedAt?: Date
    /**
     * The board's height in dp, as the host reports it. Boards use it to decide
     * how many departures to show; omitted or 0 means "not measured yet".
     */
    heightDp?: number
}

/** What one board needs in order to work out how many rows fit inside it. */
export type BoardFit = {
    /** Everything above and below the rows: header, borders, list padding. */
    chromeHeight: number
    /** Height of a single departure row. */
    rowHeight: number
    /** Never show fewer than this, even if the host says there is no room. */
    min: number
    /** Never show more than this, however tall the widget is stretched. */
    max: number
}

/**
 * How many departure rows fit in a board of the given height.
 *
 * Android reports 0 until it has measured the widget, and the board is rendered
 * before the first resize event arrives — so an unknown height falls back to the
 * minimum rather than rendering an empty board.
 */
export function departuresThatFit(heightDp: number | undefined, fit: BoardFit): number {
    if (!heightDp || heightDp <= 0) return fit.min;
    const fits = Math.floor((heightDp - fit.chromeHeight) / fit.rowHeight);
    return Math.max(fit.min, Math.min(fit.max, fits));
}

/** Formats a fetch time as wall-clock `HH:mm` in the operator's own zone. */
export function formatUpdatedAt(at: Date, presentation: BoardPresentation): string {
    return new Intl.DateTimeFormat(presentation.locale, {
        timeZone: presentation.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(at);
}

/** Renders a countdown the way the active provider words it. */
export function formatCountdown(departsInMillis: number, presentation: BoardPresentation): string {
    const minutes = Math.ceil(departsInMillis / (1000 * 60));
    return minutes
        ? `${minutes}${presentation.strings.minutesSuffix}`
        : presentation.strings.now;
}
