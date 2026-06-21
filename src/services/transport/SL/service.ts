import * as SQLite from 'expo-sqlite';
import { DepartureEntry, GenericTransportService, StopOption, TransportTypeCode, TransportTypeOption } from "../genericTransportService";
import { fetchSiteDepartures, fetchSLSites, fetchSLStopPoints, SLAPIStopAreaType } from './api';

const SL_STOPS_CACHE_DB = 'SL_STOPS_CACHE';

enum SLServiceTransportType {
    METRO = 'METRO',
    COMMUTER = 'COMMUTER',
    UNKNOWN = 'UNKNOWN',
}

type LineColor = `#${string}`;

export type AdditionalSLStopInfo = {
    lineColor: LineColor,
    isShortTrain?: boolean,
    serviceInfo: string
}

const mainLineColors: {[s: string]: LineColor} = {
    RED: '#e32222',
    GREEN: '#05662a',
    BLUE: '#4785e7',
    PINK: '#f166a7',
    FALLBACK: '#ffff',
}

export class SLService extends GenericTransportService<AdditionalSLStopInfo> {
    _db: SQLite.SQLiteDatabase | undefined = undefined;

    constructor() {
        super();
    }

    public async init() {
        // Check if SL stops data already stored in Storage
        const fetchedOnExists = await this.runCacheDBQuery(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='cache_fetched_on';`
        );
        if (fetchedOnExists.length) {
            const fetchedOn = await this.runCacheDBQuery<{fetchedOn: string}>(
                'SELECT * FROM cache_fetched_on'
            )
            // If cache exists and is not older than 1 month, reuse it and skip network
            const fetchedDate = fetchedOn[0]?.fetchedOn ? new Date(fetchedOn[0].fetchedOn) : null;
            const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
            const cachedStopOptions: StopOption[] = await this.getStopOptionsFromDB(
                this.getAvailableTransportOptions().map(o => o.typeCode)
            )
            if (fetchedDate && (Date.now() - fetchedDate.getTime()) <= ONE_MONTH_MS) {
                if (cachedStopOptions.length) {
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
                // ) map.set(sa.id, SLService.mapSLStopAreaTypeToTransportType(
                ) map.set(sa.stop_area.id, SLService.mapSLStopAreaTypeToTransportType(
                    sa.stop_area.type
                ));
                return map;
            }, new Map<number, SLServiceTransportType>());

            const stopOptions = sitesRes.reduce<StopOption[]>((arr, s) => {
                const validTypes = s.stop_areas.map(i => stopAreas.get(i)).filter((i): i is SLServiceTransportType => !!i);
                if (validTypes.length)
                    arr.push({
                        stopCode: s.id.toString(),
                        displayName: s.name,
                        transportOptions: validTypes
                    })
                return arr;
            }, [] as StopOption[]);
            
            // Open the database instance once for batch processing
            const db = await SQLite.openDatabaseAsync(SL_STOPS_CACHE_DB);
            // Execute everything inside a single unified transaction
            await db.withTransactionAsync(async () => {
                // Bulk drop and create tables safely
                await db.execAsync(`
                    DROP TABLE IF EXISTS stop;
                    CREATE TABLE stop (code TEXT PRIMARY KEY, displayName TEXT);
                    DROP TABLE IF EXISTS stop_transport_option;
                    CREATE TABLE stop_transport_option (stopCode TEXT, option TEXT);
                    DROP TABLE IF EXISTS cache_fetched_on;
                    CREATE TABLE cache_fetched_on (fetchedOn TEXT);
                `);
                // Prepare statements to be reused across loop iterations
                const insertStopStmt = await db.prepareAsync(
                    `INSERT INTO stop (code, displayName) VALUES ($code, $displayName)`
                );
                const insertOptionStmt = await db.prepareAsync(
                    `INSERT INTO stop_transport_option (stopCode, option) VALUES ($stopCode, $option)`
                );
                const insertDateStmt = await db.prepareAsync(
                    `INSERT INTO cache_fetched_on VALUES ($fetchedOn)`
                );

                try {
                    // Sequentially feed the statements inside the active transaction loop
                    for (const s of stopOptions) {
                        await insertStopStmt.executeAsync({ $code: s.stopCode, $displayName: s.displayName });
                        
                        if (s.transportOptions) {
                            for (const o of s.transportOptions) {
                                await insertOptionStmt.executeAsync({ $stopCode: s.stopCode, $option: o });
                            }
                        }
                    }

                    await insertDateStmt.executeAsync({ $fetchedOn: fetchedOn.toISOString() });
                } finally {
                    // Finalize all statements together to release compiler locks
                    await insertStopStmt.finalizeAsync();
                    await insertOptionStmt.finalizeAsync();
                    await insertDateStmt.finalizeAsync();
                }
            });

        } catch (e) {
            console.error(`Error while initializing SL Service.`, e);
            throw e;
        }
    }
    
    static getLineColor(lineCode: string) {
        switch (lineCode) {
            case '10':
            case '11':
                return mainLineColors.BLUE;
            case '13':
            case '14':
                return mainLineColors.RED;
            case '17':
            case '18':
            case '19':
                return mainLineColors.GREEN;
            case '40':
            case '41':
            case '42':
            case '43':
            case '43X':
            case '48':
                return mainLineColors.PINK;
            default:
                return mainLineColors.FALLBACK;
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

    async runCacheDBQuery<R>(statement: string, values: SQLite.SQLiteBindParams = {}) {
        if (!this._db) {
            this._db = await SQLite.openDatabaseAsync(SL_STOPS_CACHE_DB);
        }
        return await this._db.getAllAsync<R>(statement, values);
    }

    async getStopOptionsFromDB(transportTypes: TransportTypeCode[]) {
        // if (!transportTypes || transportTypes.length === 0) return [];
        
        const options = transportTypes.map((_, i) => `$type${i}`).join(', ');        
        const rows = await this.runCacheDBQuery<{
            code: string,
            displayName: string,
            option: string
        }>(
            'SELECT stop.code, stop.displayName, stop_transport_option.option FROM stop ' +
            'JOIN stop_transport_option on stop.code = stop_transport_option.stopCode ' +
            `WHERE stop_transport_option.option IN (${options})`,
            Object.fromEntries(
                transportTypes.map((type, i) => [`$type${i}`, type])
            )
        );
        
        const stopMap = new Map<string, StopOption>();
        rows.forEach(row => {
            if (!stopMap.has(row.code)) {
                stopMap.set(row.code, {
                    stopCode: row.code,
                    displayName: row.displayName,
                    transportOptions: []
                });
            }
            stopMap.get(row.code)?.transportOptions?.push(row.option);
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
        return this.getStopOptionsFromDB(transportTypes);
    }

    public getLiveDeparturesFromStop(
        stopCode: string, transportTypes: TransportTypeCode[]
    ) {
        return fetchSiteDepartures<DepartureEntry<AdditionalSLStopInfo>[]>(
            stopCode, transportTypes[0], res => {
                
                // 1. Get current Stockholm time broken down into clean digits (Hermes-safe)
                const parts = new Intl.DateTimeFormat('sv-SE', {
                    timeZone: 'Europe/Stockholm',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false
                }).formatToParts(new Date());

                const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
                
                // Create a fake UTC reference point for "Right Now in Stockholm"
                const stockholmNowMillis = Date.UTC(
                    parseInt(p.year, 10),
                    parseInt(p.month, 10) - 1,
                    parseInt(p.day, 10),
                    parseInt(p.hour, 10),
                    parseInt(p.minute, 10),
                    parseInt(p.second, 10)
                );

                return res.departures.map(d => {
                    // 2. Extract digits directly from the API string "YYYY-MM-DDTHH:mm:ss"
                    const year = parseInt(d.expected.substring(0, 4), 10);
                    const month = parseInt(d.expected.substring(5, 7), 10) - 1;
                    const day = parseInt(d.expected.substring(8, 10), 10);
                    const hour = parseInt(d.expected.substring(11, 13), 10);
                    const minute = parseInt(d.expected.substring(14, 16), 10);
                    const second = parseInt(d.expected.substring(17, 19) || '0', 10);

                    // Create a matching fake UTC reference point for the departure
                    const departureMillis = Date.UTC(year, month, day, hour, minute, second);

                    // 3. Subtract them directly
                    const timeLeftInMillis = Math.max(0, departureMillis - stockholmNowMillis);
                    const lineCode = d.line.id.toString();
                    return {
                        destination: d.destination,
                        lineCode,
                        direction: 1,
                        departsInMillis: timeLeftInMillis,
                        additionalInfo: {
                            lineColor: SLService.getLineColor(lineCode),
                            isShortTrain: false,
                            serviceInfo: ''
                        }
                    };
                });
            }
        );
    }
}
