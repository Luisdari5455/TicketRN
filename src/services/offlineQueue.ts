// services/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@offlineTickets/v1';

export type OfflineTicket = {
  id: string; // provisionalId
  createdAt: number;
  payload: any; // RegisterTicketPayload-like
};

export async function enqueueOfflineTicket(item: OfflineTicket): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY);
  const arr: OfflineTicket[] = raw ? JSON.parse(raw) : [];
  arr.push(item);
  await AsyncStorage.setItem(KEY, JSON.stringify(arr));
}

export async function getOfflineTickets(): Promise<OfflineTicket[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function removeOfflineTicket(id: string): Promise<void> {
  const list = await getOfflineTickets();
  const next = list.filter(x => x.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
