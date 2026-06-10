type SLAPISite = {
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

type SLAPIStopPoint = {
    id: number;
    stop_area: {
        id: number,
        name: string,
        type: SLAPIStopAreaType
    }
}

type SLAPITransportMode = (
    'BUS' |
    'TRAM' |
    'METRO' |
    'TRAIN' |
    'FERRY' |
    'SHIP' |
    'TAXI'
)

type SLAPIDeparture = {
    destination: string,
    display: string,
    expected: string,
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
    try {
        const res = await fetch(getAPIEndpoint(relativeEndpoint));
        try {
            const resJson = await res.json() as R;
            return mapper?.(resJson) ?? resJson;
        } catch (e) {
            console.error(`Error while parsing SL data as JSON`, e);
            throw e;
        }
    } catch (e) {
        console.error(`Error while fetching SL data.`, e);
        throw e;
    }
}

export async function fetchSLSites() {
    return await fetchDataFromSLApi<SLAPISite[]>('sites?expand=true')
}

export async function fetchSLStopPoints() {
    return await fetchDataFromSLApi<SLAPIStopPoint[]>('stop-points')
}

export async function fetchSiteDepartures<T>(
    siteId: string, transportType: string, mapper: (response: SLAPIDeparture[]) => T
) {
    return await fetchDataFromSLApi<SLAPIDeparture[], T>(
        `sites/${siteId}/departures?transport=${transportType}`, mapper
    );
}
