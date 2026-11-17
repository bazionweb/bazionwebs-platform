import { useMutation, useQuery } from '@apollo/client';
import { useMemo } from 'react';
import { RecycleBinItem } from '../components/userData';
import {
  GET_RECYCLE_BIN_QUERY,
  ADD_RECYCLE_BIN_MUTATION,
  DELETE_RECYCLE_BIN_MUTATION,
} from '../services/graphql/cleanup';

export function useRecycleBin() {
  const { data, loading, error } = useQuery(GET_RECYCLE_BIN_QUERY, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all',
  });

  const [addMutation] = useMutation(ADD_RECYCLE_BIN_MUTATION, {
    refetchQueries: [{ query: GET_RECYCLE_BIN_QUERY }],
  });
  const [deleteMutation] = useMutation(DELETE_RECYCLE_BIN_MUTATION, {
    refetchQueries: [{ query: GET_RECYCLE_BIN_QUERY }],
  });

  const items: RecycleBinItem[] = useMemo(() => {
    const edges = data?.recycle_binCollection?.edges;
    if (!edges) return [];
    return edges.map(
      (item: {
        node: {
          id: string;
          original_id: string;
          type: string;
          data: unknown;
          deleted_by: string;
          deleted_at: string;
          reason?: string;
        };
      }) => ({
        id: item.node.id,
        originalId: item.node.original_id,
        type: item.node.type,
        data: item.node.data,
        deletedBy: item.node.deleted_by,
        deletedAt: item.node.deleted_at,
        reason: item.node.reason,
      }),
    );
  }, [data]);

  const moveToRecycleBin = async (
    type: string,
    originalId: string | number,
    itemData: unknown,
    deletedBy: string,
    reason?: string,
  ) => {
    const id = `${type}_${originalId}_${Date.now()}`;
    await addMutation({
      variables: {
        object: {
          id,
          original_id: originalId.toString(),
          type,
          data: JSON.parse(JSON.stringify(itemData)),
          deleted_by: deletedBy,
          reason,
          deleted_at: new Date().toISOString(),
        },
      },
    });
    return id;
  };

  const removeFromRecycleBin = async (id: string) => {
    await deleteMutation({
      variables: { id },
    });
  };

  return {
    data: items,
    loading,
    error,
    moveToRecycleBin,
    removeFromRecycleBin,
  };
}
