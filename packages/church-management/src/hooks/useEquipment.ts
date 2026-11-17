import { useMemo } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toTitleCase } from '../utils/stringFormatter';
import { Equipment, EquipmentCondition } from '../components/equipmentData';
import { MaintenanceRecord, MaintenanceStatus, MaintenanceType } from '../components/maintenanceData';
import {
  GET_EQUIPMENT_QUERY,
  ADD_EQUIPMENT_MUTATION,
  UPDATE_EQUIPMENT_MUTATION,
  DELETE_EQUIPMENT_MUTATION,
  ADD_MAINTENANCE_MUTATION,
  UPDATE_MAINTENANCE_MUTATION,
  DELETE_MAINTENANCE_MUTATION,
} from '../services/graphql/equipment';

export function useEquipment() {
  const { data, loading, error } = useQuery(GET_EQUIPMENT_QUERY, {
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

  const equipment: Equipment[] = useMemo(() => {
    const edges = data?.equipmentCollection?.edges;
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
  }, [data]);

  const maintenanceRecords: MaintenanceRecord[] = useMemo(() => {
    const edges = data?.equipmentCollection?.edges;
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
        e.maintenance_recordsCollection?.edges?.forEach(
          (me: {
            node: {
              id: number;
              equipment_id: number;
              date: string;
              type: string;
              cost?: number;
              description?: string;
              status: string;
            };
          }) => {
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
          },
        );
      },
    );
    return allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data]);

  const addEquipment = async (item: Partial<Equipment>) => {
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
    await deleteEquipmentMutation({
      variables: { id },
    });
  };

  const addMaintenance = async (record: Omit<MaintenanceRecord, 'id'>) => {
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
    await deleteMaintenanceMutation({
      variables: { id },
    });
  };

  return {
    equipment,
    maintenanceRecords,
    loading,
    error,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    addMaintenance,
    updateMaintenance,
    deleteMaintenance,
  };
}
