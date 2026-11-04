import type { TransportTypeCode } from '@/services/transport/genericTransportService';
import type { TransportProvider } from '@/services/transport/provider';
import { ManagedDatabase } from './managedDatabase';

export const KV_STORAGE_KEYS = {
  PROVIDER: 'selected_provider',
  TRANSPORT: 'selected_transport',
  STATION: 'selected_station',
  JOURNAL: 'refresh_journal_enabled',
};

/**
 * The file and table `expo-sqlite/kv-store` used to manage, kept so that existing
 * installs hold on to their selection. See `ManagedDatabase` for why it is opened
 * directly now.
 */
const kv = new ManagedDatabase('ExpoSQLiteStorage', db =>
  db.execAsync('CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT)')
);

const UPSERT =
  'INSERT INTO storage (key, value) VALUES (?, ?) ' +
  'ON CONFLICT(key) DO UPDATE SET value = excluded.value';

async function getItem(key: string): Promise<string | null> {
  const row = await kv.run(db =>
    db.getFirstAsync<{ value: string }>('SELECT value FROM storage WHERE key = ?', key)
  );
  return row?.value ?? null;
}

export async function getStoredProviderId(): Promise<string | null> {
  return await getItem(KV_STORAGE_KEYS.PROVIDER);
}

export async function setProviderId(val: string) {
  await kv.run(db => db.runAsync(UPSERT, KV_STORAGE_KEYS.PROVIDER, val));
}

/**
 * The transport type for the given provider, falling back to its default.
 *
 * The stored value is passed through the provider so that codes written by an
 * earlier version can be carried forward — SL persisted commuter rail as `TRAIN`
 * before the canonical codes landed.
 */
export async function getStoredTransportType(
  provider: TransportProvider
): Promise<TransportTypeCode> {
  const stored = await getItem(KV_STORAGE_KEYS.TRANSPORT);
  return provider.normaliseTransportCode(stored) ?? provider.defaultTransportType;
}

/**
 * The saved stop for the given provider.
 *
 * Stop codes are only meaningful to the provider that issued them, so after a
 * provider switch this returns a code the new provider will not recognise. The
 * caller reconciles it against the station list and falls back to the default.
 */
export async function getStoredStation(provider: TransportProvider): Promise<string> {
  const stored = await getItem(KV_STORAGE_KEYS.STATION);
  return stored?.trim() ? stored : provider.defaultStopCode;
}

/**
 * Saves the transport and station as one pair, because the widget needs them to
 * agree. SL answers a stop that does not serve the requested mode with a 200 and
 * an empty list, so a mismatched pair reads as "no departures" rather than failing.
 */
export async function setSelection(transport: TransportTypeCode, station: string) {
  await kv.run(db =>
    db.withTransactionAsync(async () => {
      await db.runAsync(UPSERT, KV_STORAGE_KEYS.TRANSPORT, transport);
      await db.runAsync(UPSERT, KV_STORAGE_KEYS.STATION, station);
    })
  );
}

/** Whether `@/utils/refreshJournal` records anything. Off unless turned on. */
export async function getJournalEnabled(): Promise<boolean> {
  return (await getItem(KV_STORAGE_KEYS.JOURNAL)) === 'on';
}

export async function setJournalEnabled(enabled: boolean) {
  await kv.run(db => db.runAsync(UPSERT, KV_STORAGE_KEYS.JOURNAL, enabled ? 'on' : 'off'));
}
