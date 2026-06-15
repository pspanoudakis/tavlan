import * as SQLite from 'expo-sqlite';
import { DepartureEntry, GenericTransportService, StopOption, TransportTypeCode, TransportTypeOption } from "../genericTransportService";
import { fetchSiteDepartures, fetchSLSites, fetchSLStopPoints, SLAPIStopAreaType } from './api';

const SL_STOPS_CACHE_DB = 'SL_STOPS_CACHE';

type HexColor = `#${string}`;
type RgbaColor = `rgba(${number}, ${number}, ${number}, ${number})`;
type LineColor = HexColor | RgbaColor;

enum SLServiceTransportType {
    METRO = 'METRO',
    COMMUTER = 'COMMUTER',
    UNKNOWN = 'UNKNOWN',
}

export type AdditionalSLStopInfo = {
    lineColor: LineColor,
    isShortTrain?: boolean,
    serviceInfo: string
}

export class SLService extends GenericTransportService<AdditionalSLStopInfo> {

    stopOptions: StopOption[] = [];

    constructor() {
        super();
    }

    public async init() {
        // Check if SL stops data already stored in Storage
        const fetchedOnExists = await SLService.runCacheDBQuery(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='cacheFethedOn';`
        );
        if (fetchedOnExists.length) {
            const fetchedOn = await SLService.runCacheDBQuery<{fetchedOn: string}>(
                'SELECT * FROM cache_fetched_on'
            )
            // If cache exists and is not older than 1 month, reuse it and skip network
            const fetchedDate = fetchedOn[0]?.fetchedOn ? new Date(fetchedOn[0].fetchedOn) : null;
            const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
            const cachedStopOptions: StopOption[] = await SLService.getStopOptionsFromDB(
                this.getAvailableTransportOptions().map(o => o.typeCode)
            )
            if (fetchedDate && (Date.now() - fetchedDate.getTime()) <= ONE_MONTH_MS) {
                if (cachedStopOptions.length) {
                    this.stopOptions = cachedStopOptions;
                    return;
                }
            }            
        }
        // Fetch again since data is old/not present
        try {
            const fetchedOn = new Date();
            const [sitesRes, stopAreasRes] = await Promise.all([
                fetchSLSites(), fetchSLStopPoints()
            ]);

            const stopAreas = stopAreasRes.reduce((map, sa) => {
                if (sa.stop_area.type == 'METROSTN' ||
                    sa.stop_area.type == 'RAILWSTN'
                ) map.set(sa.id, SLService.mapSLStopAreaTypeToTransportType(
                    sa.stop_area.type
                ));
                return map;
            }, new Map<number, SLServiceTransportType>());

            this.stopOptions = sitesRes.reduce<StopOption[]>((arr, s) => {
                const validTypes = s.stop_areas.map(i => stopAreas.get(i)).filter(i => i);
                if (validTypes.length)
                    arr.push({
                        stopCode: s.id.toString(),
                        displayName: s.name,
                        transportOptions: validTypes as SLServiceTransportType[]
                    })
                return arr;
            }, [] as StopOption[]);
            
            // Ensure cache table exists
            await SLService.runCacheDBQuery(
                `DROP TABLE IF EXISTS stop;`
            );
            await SLService.runCacheDBQuery(
                `CREATE TABLE stop (code TEXT PRIMARY KEY, displayName TEXT)`
            );
            await SLService.runCacheDBQuery(
                `DROP TABLE IF EXISTS stop_transport_option;`
            );
            await SLService.runCacheDBQuery(
                `CREATE TABLE stop_transport_option (stopCode TEXT, option TEXT)`
            );
            await Promise.all([
                ...this.stopOptions.map((s) => SLService.runCacheDBQuery(
                    `INSERT INTO stop (code, displayName) VALUES ($code, $displayName)`,
                    { $code: s.stopCode, $displayName: s.displayName }
                )),
                ...this.stopOptions.map((s) => s.transportOptions?.map(o => SLService.runCacheDBQuery(
                    `INSERT INTO stop_transport_option (stopCode, option) VALUES ($stopCode, $option)`,
                    { $stopCode: s.stopCode, $option: o }
                )) ?? []).flat(1),
            ]);
            await SLService.runCacheDBQuery(
                `DROP TABLE IF EXISTS cache_fetched_on;`
            );
            await SLService.runCacheDBQuery(
                `CREATE TABLE IF NOT EXISTS cache_fetched_on (fetchedOn TEXT)`
            );
            await SLService.runCacheDBQuery(
                `INSERT INTO cache_fetched_on VALUES ($fetchedOn)`,
                { $fetchedOn: fetchedOn.toISOString() }
            )
        } catch (e) {
            console.error(`Error while initializing SL Service.`, e);
            throw e;
        }
    }

    static mapSLStopAreaTypeToTransportType(sat: SLAPIStopAreaType) {
        switch (sat) {
            case 'METROSTN':
                return SLServiceTransportType.METRO
            case 'RAILWSTN':
                return SLServiceTransportType.COMMUTER
            default:
                return SLServiceTransportType.UNKNOWN;
        }
    }

    static async runCacheDBQuery<R>(statement: string, values: SQLite.SQLiteBindParams = {}) {
        const db = await SQLite.openDatabaseAsync(SL_STOPS_CACHE_DB);
        const _statement = await db.prepareAsync(statement);
        try {
            return await (await _statement.executeAsync<R>(values)).getAllAsync();
        } finally {
            await _statement.finalizeAsync();
            await db.closeAsync();
        }
    }

    static async getStopOptionsFromDB(transportTypes: TransportTypeCode[]) {
        const options = transportTypes.map((_, i) => `$type${i}`).join(', ');        
        const rows = await SLService.runCacheDBQuery<{
            code: string,
            displayName: string,
            option: string
        }>(
            'SELECT stop.code, stop.displayName, stop_transport_option.option FROM stop ' +
            'JOIN stop_transport_option on stop.code = stop_transport_option.stopCode ' +
            `WHERE stop_transport_option.option IN (${options})`,
            // Object.fromEntries(
            //     transportTypes.map((type, i) => [`$type${i}`, type])
            // )
        );
        
        const stopMap = new Map<string, StopOption>();
        rows.forEach(row => {
            stopMap.getOrInsertComputed(row.code, () => ({
                stopCode: row.code,
                displayName: row.displayName,
                transportOptions: []
            }))!.transportOptions!.push(row.option);
        });
        
        return Array.from(stopMap.values());
    }

    public getAvailableTransportOptions(): TransportTypeOption[] {
        return [
            { typeCode: 'METRO', displayName: 'Tunnelbana' },
            { typeCode: 'COMMUTER', displayName: 'Pendeltåg' },
        ]
    }

    public getAvailableStops(transportTypes: TransportTypeCode[]) {
        return SLService.getStopOptionsFromDB(transportTypes);
    }

    public getLiveDeparturesFromStop(
        stopCode: string, transportTypes: TransportTypeCode[]
    ) {
        return fetchSiteDepartures<DepartureEntry<AdditionalSLStopInfo>[]>(
            stopCode, transportTypes[0], res => {
                return res.departures.map(d => ({
                    destination: d.destination,
                    lineCode: d.line.id.toString(),
                    direction: 1,
                    departsInMillis: new Date(d.expected).getTime(),
                    additionalInfo: {
                        lineColor: '#05662a',
                        isShortTrain: false,
                        serviceInfo: ''
                    }
                }))
            }
        )
    }
}
