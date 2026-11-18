import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from '../shims/apollo';
import { SmsRecord } from '../components/smsData';
import { hkmApiRequest, HkmIdMap } from '../services/hkmApi';
import { GET_SMS_QUERY, ADD_SMS_MUTATION, DELETE_SMS_MUTATION } from '../services/graphql/sms';

interface ApiSmsRecord {
  id: string;
  recipientCount: number;
  message: string;
  status: string;
  date: string;
}

export function useSms() {
  const [monthsBack, setMonthsBack] = useState(3);

  const startDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsBack);
    return d.toISOString().split('T')[0];
  }, [monthsBack]);

  const {
    data: queryData,
    loading: queryLoading,
    error,
  } = useQuery(GET_SMS_QUERY, {
    variables: { startDate },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all',
  });

  const [addSmsMutation] = useMutation(ADD_SMS_MUTATION);
  const [deleteSmsMutation] = useMutation(DELETE_SMS_MUTATION);

  const smsIdMapRef = useRef(new HkmIdMap());
  const apiReadyRef = useRef(false);
  const [apiRows, setApiRows] = useState<ApiSmsRecord[] | null>(null);
  const [apiLoading, setApiLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await hkmApiRequest<ApiSmsRecord[]>(`/api/church/hkm/sms?since=${encodeURIComponent(startDate)}`);
      apiReadyRef.current = true;
      setApiRows(rows);
    } catch {
      // Keep Apollo fallback when API endpoint is unavailable (e.g. standalone unit tests)
    } finally {
      setApiLoading(false);
    }
  }, [startDate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const smsRecords: SmsRecord[] = useMemo(() => {
    if (apiRows !== null) {
      return apiRows.map((s) => ({
        id: smsIdMapRef.current.numericId(s.id),
        recipientCount: s.recipientCount,
        message: s.message,
        status: (s.status === 'Pending' || s.status === 'Failed' ? s.status : 'Sent') as SmsRecord['status'],
        date: s.date,
      }));
    }
    const edges = queryData?.sms_recordsCollection?.edges;
    if (!edges) return [];
    return edges.map(
      (e: { node: { id: number; recipient_count: number; message: string; status: string; date: string } }) => {
        const s = e.node;
        return {
          id: s.id,
          recipientCount: s.recipient_count,
          message: s.message,
          status: s.status as 'Sent' | 'Pending' | 'Failed',
          date: s.date,
        };
      },
    );
  }, [apiRows, queryData]);

  const loadMore = () => {
    setMonthsBack((prev) => prev + 3);
  };

  const addSmsRecord = async (record: Omit<SmsRecord, 'id'>) => {
    if (apiReadyRef.current) {
      await hkmApiRequest('/api/church/hkm/sms', {
        method: 'POST',
        body: JSON.stringify({
          recipientCount: record.recipientCount,
          message: record.message,
          status: record.status,
          date: record.date,
        }),
      });
      await refresh();
      return;
    }
    await addSmsMutation({
      variables: {
        object: {
          recipient_count: record.recipientCount,
          message: record.message,
          status: record.status,
          date: record.date,
        },
      },
      refetchQueries: [{ query: GET_SMS_QUERY }],
    });
  };

  const deleteSmsRecord = async (id: number) => {
    if (apiReadyRef.current) {
      const uuid = smsIdMapRef.current.resolve(id);
      await hkmApiRequest(`/api/church/hkm/sms/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
      await refresh();
      return;
    }
    await deleteSmsMutation({
      variables: { id },
      refetchQueries: [{ query: GET_SMS_QUERY }],
    });
  };

  return {
    data: smsRecords,
    loading: apiRows !== null ? apiLoading : queryLoading && !queryData,
    error: apiReadyRef.current ? undefined : error,
    addSmsRecord,
    deleteSmsRecord,
    loadMore,
    monthsBack,
    setData: () => {},
  };
}
