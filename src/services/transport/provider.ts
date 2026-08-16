import type { TransportErrorStrings } from './errors';
import type { GenericTransportService, TransportTypeCode } from './genericTransportService';

/**
 * A `require()`d asset, or a remote/data URI.
 *
 * Mirrors `ImageWidgetSource` rather than importing it, so the service layer
 * stays free of any dependency on the widget library. Should the two ever
 * diverge, passing an icon to the header stops compiling.
 */
export type ProviderIconSource =
    | number
    | `http:${string}`
    | `https:${string}`
    | `data:image${string}`;

/** Copy a board renders. Every provider supplies it in its own language. */
export type BoardStrings = {
    /** Shown when the stop is served but nothing is due. */
    noDepartures: string;
    /** Shown instead of a countdown for a departure that is leaving now. */
    now: string;
    /** Appended to a whole number of minutes, including any leading space. */
    minutesSuffix: string;
    /** Accessibility label for the board as a whole. */
    refreshHint: (stationName: string) => string;
    errors: TransportErrorStrings;
};

/**
 * Everything a board needs in order to render a provider's departures without
 * knowing which provider they came from.
 */
export type BoardPresentation = {
    /** BCP 47 tag used for formatting and collation, e.g. `sv-SE`. */
    locale: string;
    /** IANA zone the operator's timetable is published in, e.g. `Europe/Stockholm`. */
    timeZone: string;
    strings: BoardStrings;
    /** Badge shown beside the station name for a given transport type. */
    iconFor(transportType: TransportTypeCode): ProviderIconSource;
};

/**
 * One transport operator: its service, its presentation, and the defaults a
 * fresh install should start from.
 *
 * `BoardPresentation` is extended rather than nested so a provider can be passed
 * straight to a board, while a board can only reach the presentation half.
 */
export type TransportProvider = BoardPresentation & {
    /** Stable key, persisted in storage and used to look the provider back up. */
    id: string;
    /** Operator name shown in the provider picker. */
    displayName: string;

    /** Selection a fresh install starts from, before the user chooses. */
    defaultTransportType: TransportTypeCode;
    defaultStopCode: string;

    /**
     * Maps a transport code persisted by an earlier version of this provider
     * onto a current one, or returns null if it means nothing any more.
     */
    normaliseTransportCode(stored: string | null): TransportTypeCode | null;

    createService(): GenericTransportService<unknown>;
};
