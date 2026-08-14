import type { TransportTypeCode } from '@/services/transport/genericTransportService';
import type { TransportProvider } from '@/services/transport/provider';
import { Storage } from 'expo-sqlite/kv-store';

export const KV_STORAGE_KEYS = {
  PROVIDER: 'selected_provider',
  TRANSPORT: 'selected_transport',
  STATION: 'selected_station',
};

export async function getStoredProviderId(): Promise<string | null> {
  return await Storage.getItemAsync(KV_STORAGE_KEYS.PROVIDER);
}

export async function setProviderId(val: string) {
  await Storage.setItemAsync(KV_STORAGE_KEYS.PROVIDER, val);
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
  const stored = await Storage.getItemAsync(KV_STORAGE_KEYS.TRANSPORT);
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
  const stored = await Storage.getItemAsync(KV_STORAGE_KEYS.STATION);
  return stored?.trim() ? stored : provider.defaultStopCode;
}

export async function setTransportType(val: TransportTypeCode) {
  await Storage.setItemAsync(KV_STORAGE_KEYS.TRANSPORT, val);
}

export async function setStation(val: string) {
  await Storage.setItemAsync(KV_STORAGE_KEYS.STATION, val);
}
