import type * as SQLite from 'expo-sqlite';
import { ManagedDatabase } from '@/utils/managedDatabase';
import { StopCacheError, StopNotConfiguredError, TransportApiError, TransportUnreachableError } from '../errors';
import { DepartureEntry, GenericTransportService, LineColor, StopOption, TransportTypeCode, TransportTypeOption } from "../genericTransportService";
import { fetchSiteDepartures, fetchSLSites, fetchSLStopPoints, SLAPITransportMode } from './api';
import { buildStationList, SLServiceTransportType } from './stations';

const SL_STOPS_CACHE_DB = 'SL_STOPS_CACHE';

/** Shared by every query and the cache rebuild. */
const stopsDb = new ManagedDatabase(SL_STOPS_CACHE_DB);

/**
 * SL publishes its timetable in Stockholm wall-clock time with no offset, so the
 * zone is a property of the data rather than of the device reading it.
 */
export const SL_TIME_ZONE = 'Europe/Stockholm';
export const SL_LOCALE = 'sv-SE';

/** The stop catalogue is near-static, so a month-old copy is still good. */
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Bump whenever the cache schema changes, or whenever `buildStationList` starts
 * producing different rows from the same input.
 *
 * Freshness alone is not enough to decide a cache is usable: an install that
 * already holds a recent copy would otherwise keep serving stations derived by
 * the previous algorithm until the month elapsed. Version 2 was the move from
 * listing sites to listing stations; version 3 drops metro platforms with no
 * entrance, which are built but not yet open.
 */
const CACHE_VERSION = 3;

/** Every table the cache needs; they are created together in one transaction. */
const CACHE_TABLES = ['stop', 'stop_transport_option', 'cache_fetched_on'];

/**
 * What a cache is good for: `stale` is an old but intact copy, which is still
 * worth serving, whereas `unusable` has nothing that can be read.
 */
type CacheState = 'fresh' | 'stale' | 'unusable';

export type AdditionalSLStopInfo = {
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
    /** The rebuild in progress, so that concurrent widget updates share one. */
    private rebuilding: Promise<void> | null = null;

    constructor() {
        super();
    }

    public async init() {
        const state = await this.inspectCache();
        if (state === 'fresh') return;

        const rebuild = this.rebuilding ??= this.rebuildCache().finally(() => {
            this.rebuilding = null;
        });

        if (state === 'unusable') {
            await rebuild;
            return;
        }

        // Downloading the catalogue takes long enough to use up a widget task's
        // 30 seconds, and an old copy of it is nearly always still correct.
        rebuild.catch(e => console.warn('SL stop cache could not be refreshed; keeping the old copy.', e));
    }

    /**
     * Runs on every widget update, so it stays to cheap metadata lookups rather
     * than reading the catalogue itself.
     */
    private async inspectCache(): Promise<CacheState> {
        try {
            return await stopsDb.run(async db => {
                // Cheapest check first, and the only one that survives a schema change:
                // `user_version` is 0 on any cache written before versioning existed.
                const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
                if ((version?.user_version ?? 0) !== CACHE_VERSION) {
                    console.log(
                        `SL stop cache is version ${version?.user_version ?? 0}, expected ${CACHE_VERSION}; rebuilding.`
                    );
                    return 'unusable';
                }

                const placeholders = CACHE_TABLES.map((_, i) => `$table${i}`).join(', ');
                const tables = await db.getAllAsync<{ name: string }>(
                    `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${placeholders})`,
                    Object.fromEntries(CACHE_TABLES.map((t, i) => [`$table${i}`, t]))
                );
                // A partially built cache is unusable; rebuild rather than query into it.
                if (tables.length < CACHE_TABLES.length) return 'unusable';

                const anyStop = await db.getFirstAsync<{ present: number }>(
                    'SELECT 1 AS present FROM stop LIMIT 1'
                );
                if (!anyStop) return 'unusable';

                const fetched = await db.getFirstAsync<{ fetchedOn: string }>(
                    'SELECT fetchedOn FROM cache_fetched_on'
                );
                // A negative age means the clock moved backwards; treat that as stale too.
                const age = Date.now() - new Date(fetched?.fetchedOn ?? NaN).getTime();
                return Number.isNaN(age) || age < 0 || age > CACHE_MAX_AGE_MS ? 'stale' : 'fresh';
            });
        } catch (e) {
            // An unreadable cache is not fatal on its own — rebuilding may fix it.
            console.warn('SL stop cache could not be inspected, rebuilding.', e);
            return 'unusable';
        }
    }

    private async rebuildCache() {
        try {
            console.log('re-initializing DB...')
            const fetchedOn = new Date();
            // Not inside `stopsDb.run`: that would hold up every query on the
            // connection for as long as this download takes.
            const [sitesRes, stopAreasRes] = await Promise.all([
                fetchSLSites(), fetchSLStopPoints()
            ]);

            const stopOptions = buildStationList(sitesRes, stopAreasRes);

            try {
                await this.writeCache(stopOptions, fetchedOn);
            } catch (e) {
                // This already failed on a fresh connection, so the file itself is
                // suspect — and being a cache, it can simply be thrown away.
                console.warn('SL stop cache could not be written, recreating the file.', e);
                await stopsDb.destroy();
                await this.writeCache(stopOptions, fetchedOn);
            }
            console.log(`SL stop cache rebuilt: ${stopOptions.length} stations (version ${CACHE_VERSION}).`);

        } catch (e) {
            console.error(`Error while initializing SL Service.`, e);
            // A failed fetch is the caller's to describe; only wrap real cache faults.
            if (e instanceof TransportApiError || e instanceof TransportUnreachableError) throw e;
            throw new StopCacheError('rebuild', e);
        }
    }

    private writeCache(stopOptions: StopOption[], fetchedOn: Date) {
        return stopsDb.run(db =>
            // Execute everything inside a single unified transaction
            db.withTransactionAsync(async () => {
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

                // Part of the transaction, so a rebuild interrupted partway is
                // retried rather than trusted.
                await db.execAsync(`PRAGMA user_version = ${CACHE_VERSION}`);
            })
        );
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
    

    /**
     * Translates a canonical transport code into the spelling SL's departures
     * endpoint expects. The two vocabularies agree on `METRO` but not on commuter
     * rail: sending our `COMMUTER` is rejected with
     * `"COMMUTER is not a valid enum value"`.
     */
    static toAPITransportMode(code: TransportTypeCode): SLAPITransportMode {
        switch (code) {
            case SLServiceTransportType.METRO:
                return 'METRO';
            case SLServiceTransportType.COMMUTER:
                return 'TRAIN';
            default:
                throw new Error(`No SL transport mode for code '${code}'`);
        }
    }

    runCacheDBQuery<R>(statement: string, values: SQLite.SQLiteBindParams = {}) {
        return stopsDb.run(db => db.getAllAsync<R>(statement, values));
    }

    async getStopOptionsFromDB(transportTypes: TransportTypeCode[]) {
        // An empty list would render as `IN ()`, which is a SQL syntax error.
        if (!transportTypes.length) return [];

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

    public async getStopNameByCode(code: string): Promise<string | undefined> {
        return (
            await this.runCacheDBQuery<{ displayName: string }>(
                'SELECT displayName FROM stop WHERE code = $code',
                { $code: code }
            )
        )[0]?.displayName
    }

    public getAvailableStops(transportTypes: TransportTypeCode[]) {
        return this.getStopOptionsFromDB(transportTypes);
    }

    // `async` so that the guards below surface as rejections, matching how the
    // rest of the call fails.
    public async getLiveDeparturesFromStop(
        stopCode: string, transportTypes: TransportTypeCode[]
    ) {
        // Without this the request goes out as `sites//departures`, which SL
        // answers with a 400 rather than an empty list.
        if (!stopCode.trim()) throw new StopNotConfiguredError();

        return fetchSiteDepartures<DepartureEntry<AdditionalSLStopInfo>[]>(
            stopCode, SLService.toAPITransportMode(transportTypes[0]), res => {
                
                // 1. Get current Stockholm time broken down into clean digits (Hermes-safe)
                const parts = new Intl.DateTimeFormat(SL_LOCALE, {
                    timeZone: SL_TIME_ZONE,
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
                        id: d.journey.id.toString(),
                        destination: d.destination,
                        lineCode,
                        direction: 1,
                        departsInMillis: timeLeftInMillis,
                        lineColor: SLService.getLineColor(lineCode),
                        additionalInfo: {
                            isShortTrain: false,
                            serviceInfo: ''
                        }
                    };
                });
            }
        );
    }
}
