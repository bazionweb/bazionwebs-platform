/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DBSchema {
  [storeName: string]: {
    key: any;
    value: any;
    indexes?: { [indexName: string]: any };
  };
}

export interface IDBPDatabase<_DBTypes extends DBSchema = any> {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string, options?: any): any;
  get(storeName: string, key: any): Promise<any>;
  getAll(storeName: string): Promise<any[]>;
  put(storeName: string, value: any, key?: any): Promise<any>;
  add(storeName: string, value: any, key?: any): Promise<any>;
  delete(storeName: string, key: any): Promise<void>;
  clear(storeName: string): Promise<void>;
  transaction(storeNames: string | string[], mode?: string): any;
}

const memoryStores = new Map<string, Map<any, any>>();

export async function openDB<_DBTypes extends DBSchema = any>(
  name: string,
  _version?: number,
  options?: { upgrade?: (db: IDBPDatabase<_DBTypes>, oldVersion: number, newVersion: number | null, transaction: any) => void },
): Promise<IDBPDatabase<_DBTypes>> {
  if (!memoryStores.has(name)) {
    memoryStores.set(name, new Map());
  }

  const stores = memoryStores.get(name)!;

  const fakeDb: IDBPDatabase<_DBTypes> = {
    objectStoreNames: {
      contains(sName: string) {
        return stores.has(sName);
      },
    },
    createObjectStore(sName: string) {
      if (!stores.has(sName)) stores.set(sName, new Map());
      return {
        createIndex: () => {},
      };
    },
    async get(storeName: string, key: any) {
      return stores.get(storeName)?.get(key);
    },
    async getAll(storeName: string) {
      return Array.from(stores.get(storeName)?.values() || []);
    },
    async put(storeName: string, value: any, key?: any) {
      if (!stores.has(storeName)) stores.set(storeName, new Map());
      const effectiveKey = key ?? value?.id ?? String(Date.now());
      stores.get(storeName)!.set(effectiveKey, value);
      return effectiveKey;
    },
    async add(storeName: string, value: any, key?: any) {
      return fakeDb.put(storeName, value, key);
    },
    async delete(storeName: string, key: any) {
      stores.get(storeName)?.delete(key);
    },
    async clear(storeName: string) {
      stores.get(storeName)?.clear();
    },
    transaction(storeNames: string | string[], _mode?: string) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return {
        objectStore(sName: string) {
          return {
            get: (key: any) => fakeDb.get(sName, key),
            getAll: () => fakeDb.getAll(sName),
            put: (value: any, key?: any) => fakeDb.put(sName, value, key),
            delete: (key: any) => fakeDb.delete(sName, key),
            clear: () => fakeDb.clear(sName),
          };
        },
        done: Promise.resolve(),
      };
    },
  };

  if (options?.upgrade) {
    options.upgrade(fakeDb, 0, 1, fakeDb.transaction([]));
  }

  return fakeDb;
}
