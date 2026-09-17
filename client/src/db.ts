import type { Folder, Note, Task } from './types';

const DATABASE = 'sharednotes';
const STORE = 'notes';
const META = 'meta';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(store: string, mode: IDBTransactionMode, action: (objectStore: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(store, mode).objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const localStore = {
  list: async (): Promise<Note[]> => transaction(STORE, 'readonly', (store) => store.getAll()),
  put: async (note: Note): Promise<IDBValidKey> => transaction(STORE, 'readwrite', (store) => store.put(note)),
  remove: async (id: string): Promise<undefined> => transaction(STORE, 'readwrite', (store) => store.delete(id)),
  getMeta: async (key: string): Promise<string | undefined> => transaction(META, 'readonly', (store) => store.get(key)),
  setMeta: async (key: string, value: string): Promise<IDBValidKey> => transaction(META, 'readwrite', (store) => store.put(value, key))
  ,listFolders: async (): Promise<Folder[]> => transaction('folders', 'readonly', (store) => store.getAll())
  ,putFolder: async (folder: Folder): Promise<IDBValidKey> => transaction('folders', 'readwrite', (store) => store.put(folder))
  ,listTasks: async (): Promise<Task[]> => transaction('tasks', 'readonly', (store) => store.getAll())
  ,putTask: async (task: Task): Promise<IDBValidKey> => transaction('tasks', 'readwrite', (store) => store.put(task))
};
