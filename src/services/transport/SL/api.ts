import { TransportApiError, TransportUnreachableError } from '../errors';

export type SLAPISite = {
    id: number;
    name: string;
    stop_areas: number[]
}

export type SLAPIStopAreaType = (
    'SHIPBER' |
    'BUSTERM' |
    'METROSTN' |
    'TRAMSTN' |
    'RAILWSTN' |
    'FERRYBER' |
    'UNKNOWN'
)

export type SLAPIStopPoint = {
    id: number;
    /** Whether passengers can enter here. False on platforms not yet in service. */
    has_entrance: boolean;
    stop_area: {
        id: number,
        name: string,
        type: SLAPIStopAreaType
    }
}

/**
 * Transport modes as SL's API spells them. Note that commuter rail is `TRAIN`
 * here, while our canonical code for it is `COMMUTER` — see
 * `SLService.toAPITransportMode`.
 */
export type SLAPITransportMode = (
    'BUS' |
    'TRAM' |
    'METRO' |
    'TRAIN' |
    'FERRY' |
    'SHIP' |
    'TAXI'
)

type SLAPISiteDeparturesResponse = {
    departures: SLAPIDeparture[]
}

type SLAPIDeparture = {
    destination: string,
    display: string,
    expected: string,
    // Unique per scheduled train run, so it is stable enough to key a rendered row.
    journey: {
        id: number
    },
    line: {
        id: number,
        transport_mode: SLAPITransportMode
    }
}

function getAPIEndpoint(relativeEndpoint: string) : string {
    return `https://transport.integration.sl.se/v1/${relativeEndpoint}`
}

async function fetchDataFromSLApi<R>(relativeEndpoint: string): Promise<R>;
async function fetchDataFromSLApi<R, T>(relativeEndpoint: string, mapper: (response: R) => T): Promise<T>;
async function fetchDataFromSLApi<R, T>(relativeEndpoint: string, mapper?: (response: R) => T): Promise<R | T> {
    // Only reaching the API and reading its bytes count as transport failures.
    let res: Response;
    let rawBody: string;
    try {
        res = await fetch(getAPIEndpoint(relativeEndpoint));
        rawBody = await res.text();
    } catch (e) {
        throw new TransportUnreachableError(e);
    }

    // Parsed leniently, because SL answers some rejections with invalid JSON —
    // a malformed stop id comes back as `{"message": 400 Bad requst ...}`. The
    // status is therefore more trustworthy than the body.
    let body: unknown;
    try {
        body = JSON.parse(rawBody);
    } catch {
        body = undefined;
    }

    if (!res.ok) {
        // SL describes its rejections in a `description` field; fall back to
        // whatever it did send when the body is not the expected shape.
        const description =
            (body as { description?: string } | undefined)?.description ??
            (rawBody.trim() || res.statusText || 'unknown error');
        throw new TransportApiError(res.status, description);
    }

    if (body === undefined) {
        throw new TransportApiError(res.status, `unreadable response body: ${rawBody.slice(0, 120)}`);
    }

    return mapper ? mapper(body as R) : (body as R);
}

export async function fetchSLSites() {
    return await fetchDataFromSLApi<SLAPISite[]>('sites?expand=true')
}

export async function fetchSLStopPoints() {
    return await fetchDataFromSLApi<SLAPIStopPoint[]>('stop-points')
}

export async function fetchSiteDepartures<T>(
    siteId: string,
    transportMode: SLAPITransportMode,
    mapper: (response: SLAPISiteDeparturesResponse) => T
) {
    return await fetchDataFromSLApi<SLAPISiteDeparturesResponse, T>(
        `sites/${encodeURIComponent(siteId)}/departures?transport=${transportMode}`, mapper
    );
}
