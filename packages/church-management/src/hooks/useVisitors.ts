import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '../shims/apollo';
import { toTitleCase, formatEmail } from '../utils/stringFormatter';
import { Visitor, FollowUp, VisitorStatus } from '../components/visitorData';
import { hkmApiRequest, HkmIdMap } from '../services/hkmApi';
import {
  GET_VISITORS_QUERY,
  ADD_VISITOR_MUTATION,
  UPDATE_VISITOR_MUTATION,
  DELETE_VISITOR_MUTATION,
  ADD_FOLLOW_UP_MUTATION,
  UPDATE_FOLLOW_UP_MUTATION,
  DELETE_FOLLOW_UP_MUTATION,
} from '../services/graphql/visitors';

interface ApiFollowUpRecord {
  id: string;
  visitorId: string;
  date: string;
  interactionType: string;
  notes: string;
  nextFollowUpDate?: string;
  outcome: string;
}

interface ApiVisitorRecord {
  id: string;
  name: string;
  initials: string;
  phone: string;
  email?: string;
  heardFrom: string;
  firstVisit: string;
  registeredDate: string;
  status: string;
  followUps?: ApiFollowUpRecord[];
}

export function useVisitors() {
  const { data: apolloData, loading: apolloLoading, error: apolloError } = useQuery(GET_VISITORS_QUERY, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all',
  });
  const [addVisitorMutation] = useMutation(ADD_VISITOR_MUTATION, { refetchQueries: [{ query: GET_VISITORS_QUERY }] });
  const [updateVisitorMutation] = useMutation(UPDATE_VISITOR_MUTATION, {
    refetchQueries: [{ query: GET_VISITORS_QUERY }],
  });
  const [deleteVisitorMutation] = useMutation(DELETE_VISITOR_MUTATION, {
    refetchQueries: [{ query: GET_VISITORS_QUERY }],
  });
  const [addFollowUpMutation] = useMutation(ADD_FOLLOW_UP_MUTATION, {
    refetchQueries: [{ query: GET_VISITORS_QUERY }],
  });
  const [updateFollowUpMutation] = useMutation(UPDATE_FOLLOW_UP_MUTATION, {
    refetchQueries: [{ query: GET_VISITORS_QUERY }],
  });
  const [deleteFollowUpMutation] = useMutation(DELETE_FOLLOW_UP_MUTATION, {
    refetchQueries: [{ query: GET_VISITORS_QUERY }],
  });

  const visitorIdMapRef = useRef(new HkmIdMap());
  const followUpIdMapRef = useRef(new HkmIdMap());
  const apiReadyRef = useRef(false);
  const [apiRows, setApiRows] = useState<ApiVisitorRecord[] | null>(null);
  const [apiLoading, setApiLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await hkmApiRequest<ApiVisitorRecord[]>('/api/church/hkm/visitors');
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

  const visitors: Visitor[] = useMemo(() => {
    if (apiRows !== null) {
      return apiRows.map((v): Visitor => {
        const visitorNumId = visitorIdMapRef.current.numericId(v.id);
        return {
          id: visitorNumId,
          name: v.name,
          initials: v.initials || '',
          phone: v.phone || '',
          email: v.email || undefined,
          heardFrom: v.heardFrom || '',
          firstVisit: v.firstVisit || '',
          registeredDate: v.registeredDate || '',
          status: v.status as VisitorStatus,
          followUps: (v.followUps ?? []).map((f) => ({
            id: followUpIdMapRef.current.numericId(f.id),
            visitorId: visitorNumId,
            date: f.date,
            interactionType: f.interactionType as FollowUp['interactionType'],
            notes: f.notes || '',
            nextFollowUpDate: f.nextFollowUpDate || undefined,
            outcome: f.outcome || '',
          })),
        };
      });
    }
    if (!apolloData?.visitorsCollection?.edges) return [];
    return apolloData.visitorsCollection.edges.map((edge: { node: Record<string, unknown> }): Visitor => {
      const v = edge.node as {
        id: number;
        name: string;
        initials?: string;
        phone?: string;
        email?: string;
        heard_from?: string;
        first_visit?: string;
        registered_date?: string;
        status: string;
        follow_upsCollection?: {
          edges?: Array<{
            node: {
              id: number;
              visitor_id: number;
              date: string;
              interaction_type: string;
              notes?: string;
              next_follow_up_date?: string;
              outcome?: string;
            };
          }>;
        };
      };
      return {
        id: v.id,
        name: v.name,
        initials: v.initials || '',
        phone: v.phone || '',
        email: v.email || undefined,
        heardFrom: v.heard_from || '',
        firstVisit: v.first_visit || '',
        registeredDate: v.registered_date || '',
        status: v.status as VisitorStatus,
        followUps:
          v.follow_upsCollection?.edges?.map((fe) => {
            const f = fe.node;
            return {
              id: f.id,
              visitorId: f.visitor_id,
              date: f.date,
              interactionType: f.interaction_type as FollowUp['interactionType'],
              notes: f.notes || '',
              nextFollowUpDate: f.next_follow_up_date || undefined,
              outcome: f.outcome || '',
            };
          }) || [],
      };
    });
  }, [apiRows, apolloData]);

  const addVisitor = async (visitor: Partial<Visitor>) => {
    const { initials, registeredDate, ...rest } = visitor;
    if (apiReadyRef.current) {
      await hkmApiRequest('/api/church/hkm/visitors', {
        method: 'POST',
        body: JSON.stringify({
          name: toTitleCase(rest.name),
          phone: rest.phone || '',
          email: rest.email ? formatEmail(rest.email) : null,
          heardFrom: toTitleCase(rest.heardFrom),
          firstVisit: rest.firstVisit,
          status: rest.status || 'New',
        }),
      });
      await refresh();
      return;
    }
    await addVisitorMutation({
      variables: {
        object: {
          ...rest,
          name: toTitleCase(rest.name),
          phone: rest.phone || '',
          email: rest.email ? formatEmail(rest.email) : undefined,
          heard_from: toTitleCase(rest.heardFrom),
          first_visit: rest.firstVisit,
          initials: initials || (rest.name ? rest.name.split(' ').map((n) => n[0]).join('').toUpperCase() : ''),
          registered_date: registeredDate || new Date().toISOString().split('T')[0],
          status: rest.status || 'New',
        },
      },
    });
  };

  const updateVisitor = async (id: number, updates: Partial<Visitor>) => {
    const { id: _id, followUps: _fu, ...rest } = updates;
    if (apiReadyRef.current) {
      const payload: Record<string, unknown> = {};
      if (rest.name !== undefined) payload.name = toTitleCase(rest.name);
      if (rest.phone !== undefined) payload.phone = rest.phone;
      if (rest.email !== undefined) payload.email = rest.email ? formatEmail(rest.email) : null;
      if (rest.heardFrom !== undefined) payload.heardFrom = toTitleCase(rest.heardFrom);
      if (rest.firstVisit !== undefined) payload.firstVisit = rest.firstVisit;
      if (rest.status !== undefined) payload.status = rest.status;
      await hkmApiRequest(`/api/church/hkm/visitors/${encodeURIComponent(visitorIdMapRef.current.resolve(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refresh();
      return;
    }
    const set: Record<string, unknown> = {};
    if (rest.name) set.name = toTitleCase(rest.name);
    if (rest.phone) set.phone = rest.phone;
    if (rest.email !== undefined) set.email = rest.email ? formatEmail(rest.email) : null;
    if (rest.heardFrom) set.heard_from = toTitleCase(rest.heardFrom);
    if (rest.firstVisit) set.first_visit = rest.firstVisit;
    if (rest.status) set.status = rest.status;
    if (rest.initials) set.initials = rest.initials;

    await updateVisitorMutation({
      variables: { id, _set: set },
    });
  };

  const deleteVisitor = async (id: number) => {
    if (apiReadyRef.current) {
      await hkmApiRequest(`/api/church/hkm/visitors/${encodeURIComponent(visitorIdMapRef.current.resolve(id))}`, {
        method: 'DELETE',
      });
      await refresh();
      return;
    }
    await deleteVisitorMutation({
      variables: { id },
    });
  };

  const addFollowUp = async (followUp: Omit<FollowUp, 'id'>) => {
    if (apiReadyRef.current) {
      const visitorUuid = visitorIdMapRef.current.resolve(followUp.visitorId);
      await hkmApiRequest(`/api/church/hkm/visitors/${encodeURIComponent(visitorUuid)}/follow-ups`, {
        method: 'POST',
        body: JSON.stringify({
          date: followUp.date,
          interactionType: followUp.interactionType,
          notes: followUp.notes,
          nextFollowUpDate: followUp.nextFollowUpDate ?? null,
          outcome: followUp.outcome,
        }),
      });
      await refresh();
      return;
    }
    await addFollowUpMutation({
      variables: {
        object: {
          visitor_id: followUp.visitorId,
          date: followUp.date,
          interaction_type: followUp.interactionType,
          notes: followUp.notes,
          next_follow_up_date: followUp.nextFollowUpDate,
          outcome: followUp.outcome,
        },
      },
    });
  };

  const updateFollowUp = async (id: number, updates: Partial<FollowUp>) => {
    const set: Record<string, unknown> = {};
    if (updates.date) set.date = updates.date;
    if (updates.interactionType) set.interaction_type = updates.interactionType;
    if (updates.notes) set.notes = updates.notes;
    if (updates.nextFollowUpDate) set.next_follow_up_date = updates.nextFollowUpDate;
    if (updates.outcome) set.outcome = updates.outcome;

    await updateFollowUpMutation({
      variables: { id, _set: set },
    });
  };

  const deleteFollowUp = async (id: number) => {
    if (apiReadyRef.current) {
      const followUpUuid = followUpIdMapRef.current.resolve(id);
      await hkmApiRequest(`/api/church/hkm/visitors/follow-ups/${encodeURIComponent(followUpUuid)}`, {
        method: 'DELETE',
      });
      await refresh();
      return;
    }
    await deleteFollowUpMutation({
      variables: { id },
    });
  };

  return {
    data: visitors,
    loading: apiRows !== null ? apiLoading : apolloLoading,
    error: apiReadyRef.current ? undefined : apolloError,
    addVisitor,
    updateVisitor,
    deleteVisitor,
    addFollowUp,
    updateFollowUp,
    deleteFollowUp,
    setData: () => {},
  };
}
