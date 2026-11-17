import { useMutation, useQuery, useApolloClient } from '@apollo/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GET_PROVISIONING_QUEUE_QUERY,
  UPDATE_PROVISIONING_QUEUE_MUTATION,
  DELETE_PROVISIONING_QUEUE_MUTATION,
} from '../services/graphql/provisioning';
import { UPDATE_MEMBER_MUTATION, GET_MEMBERS_QUERY } from '../services/graphql/members';
import { ADD_AUDIT_LOG_MUTATION, ADD_NOTIFICATION_LOG_MUTATION } from '../services/graphql/transactions';
import { sendPinNotification } from '../services/pinNotificationService';
import { generateMemberPin } from '../services/provisioning';
import { generateOrgEmail, createAlias, checkAliasExists, loadImprovMXConfig } from '../services/improvmxService';

interface QueueItem {
  id: string;
  member_id: string;
  status: string;
  reason: string | null;
  retry_count: number;
  next_retry_at: string | null;
  created_at: string;
}

interface MemberNode {
  id: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  email_tier?: string;
  org_email?: string;
}

interface ProcessingResult {
  activated: string[];
  stillBlocked: string[];
  errors: string[];
}

export function useProvisioningQueue() {
  const { data, loading, refetch } = useQuery(GET_PROVISIONING_QUEUE_QUERY, {
    fetchPolicy: 'network-only',
    errorPolicy: 'all',
  });

  const [updateQueueItem] = useMutation(UPDATE_PROVISIONING_QUEUE_MUTATION);
  const [deleteQueueItem] = useMutation(DELETE_PROVISIONING_QUEUE_MUTATION);
  const [updateMember] = useMutation(UPDATE_MEMBER_MUTATION, {
    refetchQueries: [{ query: GET_MEMBERS_QUERY }],
  });
  const [addAuditLog] = useMutation(ADD_AUDIT_LOG_MUTATION);
  const [addNotificationLog] = useMutation(ADD_NOTIFICATION_LOG_MUTATION);

  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ProcessingResult | null>(null);
  const apolloClient = useApolloClient();
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const queueItems: QueueItem[] =
    data?.provisioning_queueCollection?.edges?.map((e: { node: QueueItem }) => e.node) ?? [];

  const processRetries = useCallback(async (): Promise<ProcessingResult> => {
    setProcessing(true);
    const result: ProcessingResult = { activated: [], stillBlocked: [], errors: [] };

    const now = new Date();
    const dueItems = queueItems.filter(
      (item) => item.status === 'queued' && (!item.next_retry_at || new Date(item.next_retry_at) <= now),
    );

    // Fetch members ONCE for all due items instead of once per item.
    // cache-first reuses the members already loaded into the cache at startup.
    const memberResult = await apolloClient.query({
      query: GET_MEMBERS_QUERY,
      fetchPolicy: 'cache-first',
    });
    const allMembers: MemberNode[] =
      memberResult.data?.membersCollection?.edges?.map((e: { node: MemberNode }) => e.node) ?? [];

    for (const item of dueItems) {
      try {
        await updateQueueItem({
          variables: { id: item.id, updates: { status: 'processing' } },
        });

        const memberNode = allMembers.find((e) => e.id === item.member_id);

        if (!memberNode) {
          await updateQueueItem({
            variables: {
              id: item.id,
              updates: { status: 'failed', reason: 'Member not found' },
            },
          });
          result.errors.push(`${item.member_id}: member not found`);
          continue;
        }

        const hasEmail = !!memberNode.email;
        const hasPhone = !!memberNode.phone;

        if (!hasEmail && !hasPhone) {
          const nextRetry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await updateQueueItem({
            variables: {
              id: item.id,
              updates: {
                status: 'queued',
                reason: `Missing: ${!hasEmail ? 'Email' : ''}${!hasEmail && !hasPhone ? ' and ' : ''}${!hasPhone ? 'Phone' : ''}`,
                retry_count: (item.retry_count || 0) + 1,
                next_retry_at: nextRetry,
              },
            },
          });

          try {
            await addAuditLog({
              variables: {
                object: {
                  action: 'Provisioning Retry Failed',
                  entity_type: 'member',
                  entity_id: item.member_id,
                  details: {
                    retry_count: (item.retry_count || 0) + 1,
                    reason: 'Still missing contact details',
                  },
                },
              },
            });
          } catch {
            /* audit log best-effort */
          }

          result.stillBlocked.push(item.member_id);
          continue;
        }

        const { pin: generatedPin, hashedPin } = await generateMemberPin(item.member_id);

        await updateMember({
          variables: {
            id: item.member_id,
            updates: {
              status: 'Active',
              pin: hashedPin,
              is_portal_active: true,
            },
          },
        });

        await deleteQueueItem({ variables: { id: item.id } });

        try {
          await addAuditLog({
            variables: {
              object: {
                action: 'Member Activated (Retry)',
                entity_type: 'member',
                entity_id: item.member_id,
                details: { reason: 'Provisioning queue retry succeeded' },
              },
            },
          });
        } catch {
          /* audit log best-effort */
        }

        const memberName = `${memberNode.first_name || ''} ${memberNode.last_name || ''}`.trim();
        const emailTier = memberNode.email_tier || 'member';

        const config = loadImprovMXConfig();
        const baseEmail = generateOrgEmail(memberName, config.domain || 'hkmministries.org');
        let orgEmail = '';
        if (config.apiKey && emailTier === 'member') {
          let isUnique = false;
          let attempts = 0;
          let aliasEmail = baseEmail;
          while (!isUnique && attempts < 5) {
            const checkResult = await checkAliasExists(aliasEmail);
            if (!checkResult.exists) isUnique = true;
            else {
              const randomDigits = Math.floor(100 + Math.random() * 900);
              const parts = baseEmail.split('@');
              aliasEmail = `${parts[0]}.${randomDigits}@${parts[1]}`;
            }
            attempts++;
          }
          if (isUnique) {
            const aliasResult = await createAlias(aliasEmail, memberNode.email || '');
            if (aliasResult.success) {
              await updateMember({
                variables: { id: item.member_id, updates: { org_email: aliasEmail } },
              });
              orgEmail = aliasEmail;
            }
          }
        }

        const notifResult = await sendPinNotification({
          memberId: memberNode.id,
          memberName,
          phone: memberNode.phone,
          email: memberNode.email,
          pin: generatedPin,
          orgEmail: orgEmail || undefined,
        });

        try {
          if (memberNode.phone) {
            await addNotificationLog({
              variables: {
                object: {
                  member_id: memberNode.id,
                  channel: 'sms',
                  recipient: memberNode.phone,
                  status: notifResult.sms.sent ? 'success' : 'failed',
                  error_message: notifResult.sms.error || null,
                },
              },
            });
          }
          if (memberNode.email) {
            await addNotificationLog({
              variables: {
                object: {
                  member_id: memberNode.id,
                  channel: 'email',
                  recipient: memberNode.email,
                  status: notifResult.email.sent ? 'success' : 'failed',
                  error_message: notifResult.email.error || null,
                },
              },
            });
          }
        } catch {
          /* notification log best-effort */
        }

        result.activated.push(item.member_id);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await updateQueueItem({
          variables: {
            id: item.id,
            updates: { status: 'failed', reason: errorMsg },
          },
        });
        result.errors.push(`${item.member_id}: ${errorMsg}`);
      }
    }

    await refetch();

    if (mountedRef.current) {
      setProcessing(false);
      setLastResult(result);
    }
    return result;
  }, [
    queueItems,
    apolloClient,
    updateQueueItem,
    deleteQueueItem,
    updateMember,
    addAuditLog,
    addNotificationLog,
    refetch,
  ]);

  const retryItem = useCallback(
    async (memberId: string) => {
      const item = queueItems.find((i) => i.member_id === memberId && i.status === 'queued');
      if (item) {
        await updateQueueItem({
          variables: { id: item.id, updates: { next_retry_at: new Date().toISOString() } },
        });
        await refetch();
      }
    },
    [queueItems, updateQueueItem, refetch],
  );

  return {
    queueItems,
    loading,
    processing,
    lastResult,
    processRetries,
    retryItem,
    refetch,
  };
}
