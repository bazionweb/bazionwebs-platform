// Offline Sync Service for HKM Church Management System
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface HKMDatabase extends DBSchema {
  members: {
    key: string;
    value: Record<string, unknown>;
    indexes: { 'by-sync': number };
  };
  transactions: {
    key: number;
    value: Record<string, unknown>;
    indexes: { 'by-sync': number };
  };
  attendance: {
    key: number;
    value: Record<string, unknown>;
    indexes: { 'by-sync': number };
  };
  pendingSync: {
    key: number;
    value: {
      id: number;
      type: string;
      action: 'create' | 'update' | 'delete';
      data: Record<string, unknown>;
      timestamp: number;
    };
  };
}

class OfflineSyncService {
  private db: IDBPDatabase<HKMDatabase> | null = null;
  private syncInterval: NodeJS.Timeout | null = null;

  async init() {
    this.db = await openDB<HKMDatabase>('hkm-offline-db', 1, {
      upgrade(db) {
        // Members store
        if (!db.objectStoreNames.contains('members')) {
          const memberStore = db.createObjectStore('members', { keyPath: 'id' });
          memberStore.createIndex('by-sync', 'lastSync');
        }

        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('by-sync', 'lastSync');
        }

        // Attendance store
        if (!db.objectStoreNames.contains('attendance')) {
          const attStore = db.createObjectStore('attendance', { keyPath: 'id' });
          attStore.createIndex('by-sync', 'lastSync');
        }

        // Pending sync queue
        if (!db.objectStoreNames.contains('pendingSync')) {
          db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }

  // Cache data locally
  async cacheData(storeName: 'members' | 'transactions' | 'attendance', data: Record<string, unknown>[]) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    for (const item of data) {
      await store.put({ ...item, lastSync: Date.now() });
    }
    await tx.done;
  }

  // Get cached data
  async getCachedData(storeName: 'members' | 'transactions' | 'attendance') {
    if (!this.db) await this.init();
    return await this.db!.getAll(storeName);
  }

  // Queue operation for sync
  async queueOperation(type: string, action: 'create' | 'update' | 'delete', data: Record<string, unknown>) {
    if (!this.db) await this.init();
    await this.db!.add('pendingSync', {
      type,
      action,
      data,
      timestamp: Date.now(),
    } as unknown as HKMDatabase['pendingSync']['value']);
  }

  // Get pending operations
  async getPendingOperations() {
    if (!this.db) await this.init();
    return await this.db!.getAll('pendingSync');
  }

  // Clear synced operation
  async clearSyncedOperation(id: number) {
    if (!this.db) await this.init();
    await this.db!.delete('pendingSync', id);
  }

  // Check online status
  isOnline(): boolean {
    return navigator.onLine;
  }

  // Start auto-sync
  startAutoSync(syncCallback: () => Promise<void>, intervalMs: number = 30000) {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(async () => {
      if (this.isOnline()) {
        try {
          await syncCallback();
        } catch (error) {
          console.error('Auto-sync failed:', error);
        }
      }
    }, intervalMs);
  }

  // Stop auto-sync
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const offlineSyncService = new OfflineSyncService();
