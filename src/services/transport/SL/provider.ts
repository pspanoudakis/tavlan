import type { TransportTypeCode } from '../genericTransportService';
import type { ProviderIconSource, TransportProvider } from '../provider';
import { SL_LOCALE, SL_TIME_ZONE, SLService } from './service';
import { SLServiceTransportType } from './stations';

/** The transport types SL exposes through this app. */
type SLTransportType = Exclude<SLServiceTransportType, 'UNKNOWN'>;

/**
 * `satisfies` makes a missing icon a compile error if SL ever gains a transport
 * type — `require` is typed `any`, so nothing else would catch it.
 */
const TRANSPORT_ICONS = {
    METRO: require('@/assets/images/t-bana.png'),
    COMMUTER: require('@/assets/images/sj-ptag.png'),
} satisfies Record<SLTransportType, ProviderIconSource>;

/** T-Centralen: every metro line passes through it, so a new widget shows something useful. */
const DEFAULT_STOP_CODE = '9001';

export const SLProvider: TransportProvider = {
    id: 'SL',
    displayName: 'SL (Stockholm)',

    locale: SL_LOCALE,
    timeZone: SL_TIME_ZONE,

    defaultTransportType: SLServiceTransportType.METRO,
    defaultStopCode: DEFAULT_STOP_CODE,

    strings: {
        noDepartures: 'Inga avgångar',
        now: 'Nu',
        minutesSuffix: ' min',
        refreshHint: stationName => `Avgångar från ${stationName}. Tryck för att uppdatera.`,
        errors: {
            notConfigured: 'Välj station i appen',
            unreachable: 'Ingen anslutning',
            providerDown: 'SL svarar inte',
            requestFailed: 'Kunde inte hämta avgångar',
            unknown: 'Något gick fel',
        },
    },

    iconFor(transportType: TransportTypeCode): ProviderIconSource {
        return (
            TRANSPORT_ICONS[transportType as SLTransportType] ?? TRANSPORT_ICONS.METRO
        );
    },

    normaliseTransportCode(stored: string | null): TransportTypeCode | null {
        switch (stored) {
            case SLServiceTransportType.METRO:
                return SLServiceTransportType.METRO;
            case SLServiceTransportType.COMMUTER:
            // Builds before the canonical codes landed stored SL's own spelling.
            case 'TRAIN':
                return SLServiceTransportType.COMMUTER;
            default:
                return null;
        }
    },

    createService() {
        return new SLService();
    },
};
