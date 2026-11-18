import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '../shims/apollo';
import { toTitleCase } from '../utils/stringFormatter';
import { Equipment, EquipmentCondition } from '../components/equipmentData';
import { MaintenanceRecord, MaintenanceStatus, MaintenanceType } from '../components/maintenanceData';
import { hkmApiRequest, HkmIdMap } from '../services/hkmApi';
import {
  GET_EQUIPMENT_QUERY,
  ADD_EQUIPMENT_MUTATION,
  UPDATE_EQUIPMENT_MUTATION,
  DELETE_EQUIPMENT_MUTATION,
  ADD_MAINTENANCE_MUTATION,
  UPDATE_MAINTENANCE_MUTATION,
  DELETE_MAINTENANCE_MUTATION,
} from '../services/graphql/equipment';

interface ApiMaintenanceRecord {
  id: string;
  equipmentId: string;
  date: string;
  type: string;
  cost: number;
  status: string;
  description: string;
}

interface ApiEquipmentRecord {
  id: string;
  name: string;
  category?: string;
  purchase_date?: string | null;
  purchase_price?: number | null;
  condition?: string;
  location?: string;
  description?: string;
  maintenanceRecords?: ApiMaintenanceRecord[];
}

function normalizeCondition(raw?: string): EquipmentCondition {
  switch ((raw ?? 'good').toLowerCase().replaceAll('_', ' ')) {
    case 'excellent': return 'Excellent';
    case 'fair': return 'Fair';
    case 'needs attention':
    case 'needs repair': return 'Needs Attention';
    default: return 'Good';
  }
}

export function useEquipment() {
  const { data: apolloData, loading: apolloLoading, error: apolloError } = useQuery(GET_EQUIPMENT_QUERY, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all',
  });
  const [addEquipmentMutation] = useMutation(ADD_EQUIPMENT_MUTATION, {
    refetchQueries: [{ query: GET_EQUIPMENT_QUERY }],
  });
  const [updateEquipmentMutation] = useMutation(UPDATE_EQUIPMENT_MUTATION, {
    refetchQueries: [{ query: GET_EQUIPMENT_QUERY }],
  });
  const [deleteEquipmentMutation] = useMutation(DELETE_EQUIPMENT_MUTATION, {
    refetchQueries: [{ query: GET_EQUIPMENT_QUERY }],
  });
  const [addMaintenanceMutation] = useMutation(ADD_MAINTENANCE_MUTATION, {
    refetchQueries: [{ query: GET_EQUIPMENT_QUERY }],
  });
  const [updateMaintenanceMutation] = useMutation(UPDATE_MAINTENANCE_MUTATION, {
    refetchQueries: [{ query: GET_EQUIPMENT_QUERY }],
  });
  const [deleteMaintenanceMutation] = useMutation(DELETE_MAINTENANCE_MUTATION, {
    refetchQueries: [{ query: GET_EQUIPMENT_QUERY }],
  });

  const assetIdMapRef = useRef(new HkmIdMap());
  const maintenanceIdMapRef = useRef(new HkmIdMap());
  const apiReadyRef = useRef(false);
  const [apiRows, setApiRows] = useState<ApiEquipmentRecord[] | null>(null);
  const [apiLoading, setApiLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await hkmApiRequest<ApiEquipmentRecord[]>('/api/church/hkm/equipment');
      apiReadyRef.current = true;
      setApiRows(rows);
    } catch {
      // Keep Apollo fallback when API endpoint is unavailable (e.g. standalone unit tests)
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const equipment: Equipment[] = useMemo(() => {
    if (apiRows !== null) {
      return apiRows.map((row) => ({
        id: assetIdMapRef.current.numericId(row.id),
        name: row.name,
        category: row.category || 'Other',
        purchaseDate: row.purchase_date || undefined,
        purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : undefined,
        condition: normalizeCondition(row.condition),
        location: row.location || '',
        description: row.description || '',
      }));
    }
    const edges = apolloData?.equipmentCollection?.edges;
    if (!edges) return [];
    return edges.map(
      (edge: {
        node: {
          id: number;
          name: string;
          category?: string;
          purchase_date?: string;
          purchase_price?: number;
          condition: string;
          location?: string;
          description?: string;
        };
      }) => {
        const e = edge.node;
        return {
          id: e.id,
          name: e.name,
          category: e.category || 'Other',
          purchaseDate: e.purchase_date || undefined,
          purchasePrice: e.purchase_price ? Number(e.purchase_price) : undefined,
          condition: e.condition as EquipmentCondition,
          location: e.location || '',
          description: e.description || '',
        };
      },
    );
  }, [apiRows, apolloData]);

  const maintenanceRecords: MaintenanceRecord[] = useMemo(() => {
    if (apiRows !== null) {
      const records: MaintenanceRecord[] = [];
      for (const row of apiRows) {
        const eqNumId = assetIdMapRef.current.numericId(row.id);
        for (const m of row.maintenanceRecords ?? []) {
          records.push({
            id: maintenanceIdMapRef.current.numericId(m.id),
            equipmentId: eqNumId,
            date: m.date,
            type: m.type as MaintenanceType,
            cost: Number(m.cost ?? 0),
            description: m.description || '',
            status: m.status as MaintenanceStatus,
          });
        }
      }
      return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    const edges = apolloData?.equipmentCollection?.edges;
    if (!edges) return [];
    const allRecords: MaintenanceRecord[] = [];
    edges.forEach(
      (edge: {
        node: {
          maintenance_recordsCollection?: {
            edges?: Array<{
              node: {
                id: number;
                equipment_id: number;
                date: string;
                type: string;
                cost?: number;
                description?: string;
                status: string;
              };
            }>;
          };
        };
      }) => {
        const e = edge.node;
        e.maintenance_recordsCollection?.edges?.forEach((me) => {
          const m = me.node;
          allRecords.push({
            id: m.id,
            equipmentId: m.equipment_id,
            date: m.date,
            type: m.type as MaintenanceType,
            cost: m.cost ? Number(m.cost) : 0,
            description: m.description || '',
            status: m.status as MaintenanceStatus,
          });
        });
      },
    );
    return allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [apiRows, apolloData]);

  const addEquipment = async (item: Partial<Equipment>) => {
    if (apiReadyRef.current) {
      await hkmApiRequest('/api/church/hkm/equipment', {
        method: 'POST',
        body: JSON.stringify({
          name: toTitleCase(item.name),
          category: item.category ?? 'Other',
          purchase_date: item.purchaseDate || undefined,
          purchase_price: item.purchasePrice,
          condition: item.condition === 'Needs Attention' ? 'needs_repair' : (item.condition ?? 'good').toLowerCase(),
          location: toTitleCase(item.location) || 'Main Campus',
          description: toTitleCase(item.description),
        }),
      });
      await refresh();
      return;
    }
    await addEquipmentMutation({
      variables: {
        object: {
          name: toTitleCase(item.name),
          category: item.category,
          purchase_date: item.purchaseDate,
          purchase_price: item.purchasePrice,
          condition: item.condition,
          location: toTitleCase(item.location),
          description: toTitleCase(item.description),
        },
      },
    });
  };

  const updateEquipment = async (id: number, updates: Partial<Equipment>) => {
    if (apiReadyRef.current) {
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = toTitleCase(updates.name);
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.purchaseDate !== undefined) payload.purchase_date = updates.purchaseDate;
      if (updates.purchasePrice !== undefined) payload.purchase_price = updates.purchasePrice;
      if (updates.condition !== undefined) {
        payload.condition = updates.condition === 'Needs Attention' ? 'needs_repair' : updates.condition.toLowerCase();
      }
      if (updates.location !== undefined) payload.location = toTitleCase(updates.location);
      if (updates.description !== undefined) payload.description = toTitleCase(updates.description);
      await hkmApiRequest(`/api/church/hkm/equipment/${encodeURIComponent(assetIdMapRef.current.resolve(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refresh();
      return;
    }
    const set: Record<string, unknown> = {};
    if (updates.name) set.name = toTitleCase(updates.name);
    if (updates.category) set.category = updates.category;
    if (updates.purchaseDate) set.purchase_date = updates.purchaseDate;
    if (updates.purchasePrice !== undefined) set.purchase_price = updates.purchasePrice;
    if (updates.condition) set.condition = updates.condition;
    if (updates.location) set.location = toTitleCase(updates.location);
    if (updates.description) set.description = toTitleCase(updates.description);

    await updateEquipmentMutation({
      variables: { id, _set: set },
    });
  };

  const deleteEquipment = async (id: number) => {
    if (apiReadyRef.current) {
      await hkmApiRequest(`/api/church/hkm/equipment/${encodeURIComponent(assetIdMapRef.current.resolve(id))}`, {
        method: 'DELETE',
      });
      await refresh();
      return;
    }
    await deleteEquipmentMutation({
      variables: { id },
    });
  };

  const addMaintenance = async (record: Omit<MaintenanceRecord, 'id'>) => {
    if (apiReadyRef.current) {
      const assetUuid = assetIdMapRef.current.resolve(record.equipmentId);
      await hkmApiRequest(`/api/church/hkm/equipment/${encodeURIComponent(assetUuid)}/maintenance`, {
        method: 'POST',
        body: JSON.stringify({
          date: record.date,
          type: record.type,
          cost: record.cost,
          description: record.description,
          status: record.status,
        }),
      });
      await refresh();
      return;
    }
    await addMaintenanceMutation({
      variables: {
        object: {
          equipment_id: record.equipmentId,
          date: record.date,
          type: record.type,
          cost: record.cost,
          description: record.description,
          status: record.status,
        },
      },
    });
  };

  const updateMaintenance = async (id: number, updates: Partial<MaintenanceRecord>) => {
    if (apiReadyRef.current) {
      const eventUuid = maintenanceIdMapRef.current.resolve(id);
      await hkmApiRequest(`/api/church/hkm/equipment/maintenance/${encodeURIComponent(eventUuid)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          date: updates.date,
          type: updates.type,
          cost: updates.cost,
          description: updates.description,
          status: updates.status,
        }),
      });
      await refresh();
      return;
    }
    const set: Record<string, unknown> = {};
    if (updates.date) set.date = updates.date;
    if (updates.type) set.type = updates.type;
    if (updates.cost !== undefined) set.cost = updates.cost;
    if (updates.description) set.description = updates.description;
    if (updates.status) set.status = updates.status;

    await updateMaintenanceMutation({
      variables: { id, _set: set },
    });
  };

  const deleteMaintenance = async (id: number) => {
    if (apiReadyRef.current) {
      const eventUuid = maintenanceIdMapRef.current.resolve(id);
      await hkmApiRequest(`/api/church/hkm/equipment/maintenance/${encodeURIComponent(eventUuid)}`, {
        method: 'DELETE',
      });
      await refresh();
      return;
    }
    await deleteMaintenanceMutation({
      variables: { id },
    });
  };

  return {
    equipment,
    maintenanceRecords,
    loading: apiRows !== null ? apiLoading : apolloLoading,
    error: apiReadyRef.current ? undefined : apolloError,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    addMaintenance,
    updateMaintenance,
    deleteMaintenance,
  };
}
