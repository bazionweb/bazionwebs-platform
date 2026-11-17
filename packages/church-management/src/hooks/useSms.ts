import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { SmsRecord } from '../components/smsData';
import { GET_SMS_QUERY, ADD_SMS_MUTATION, DELETE_SMS_MUTATION } from '../services/graphql/sms';

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

  const smsRecords: SmsRecord[] = useMemo(() => {
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
  }, [queryData]);

  const loadMore = () => {
    setMonthsBack((prev) => prev + 3);
  };

  const addSmsRecord = async (record: Omit<SmsRecord, 'id'>) => {
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
    await deleteSmsMutation({
      variables: { id },
      refetchQueries: [{ query: GET_SMS_QUERY }],
    });
  };

  return {
    data: smsRecords,
    loading: queryLoading && !queryData,
    error,
    addSmsRecord,
    deleteSmsRecord,
    loadMore,
    monthsBack,
    setData: () => {}, // Compatibility
  };
}
