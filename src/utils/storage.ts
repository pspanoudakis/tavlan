import { Storage } from 'expo-sqlite/kv-store';
import { TransportType } from '../widgets/common';

export const KV_STORAGE_KEYS = {
  TRANSPORT: 'selected_transport',
  STATION: 'selected_station',
};

export async function getStoredTransportType() {
  return await Storage.getItemAsync(KV_STORAGE_KEYS.TRANSPORT) as TransportType | null;
}

export async function getStoredStation() {
  return await Storage.getItemAsync(KV_STORAGE_KEYS.STATION);
}

export async function setTransportType(val: TransportType) {
  await Storage.setItemAsync(KV_STORAGE_KEYS.TRANSPORT, val);
}

export async function setStation(val: string) {
  await Storage.setItemAsync(KV_STORAGE_KEYS.STATION, val);
}
