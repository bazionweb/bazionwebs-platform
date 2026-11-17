import { useMemo } from 'react';
import { useMutation, useQuery, useApolloClient } from '@apollo/client';
import { toTitleCase } from '../utils/stringFormatter';
import { Transaction, TransactionCategory } from '../components/financeData';
import {
  GET_TRANSACTIONS_QUERY,
  ADD_TRANSACTION_MUTATION,
  UPDATE_TRANSACTION_MUTATION,
  DELETE_TRANSACTION_MUTATION,
  ADD_AUDIT_LOG_MUTATION,
  ADD_NOTIFICATION_LOG_MUTATION,
} from '../services/graphql/transactions';
import { UPDATE_MEMBER_MUTATION, GET_MEMBERS_QUERY } from '../services/graphql/members';
import { ADD_PROVISIONING_QUEUE_MUTATION, GET_PROVISIONING_QUEUE_QUERY } from '../services/graphql/provisioning';
import { sendPinNotification } from '../services/pinNotificationService';
import { generateOrgEmail, createAlias, loadImprovMXConfig, checkAliasExists } from '../services/improvmxService';
import { computeRegistrationStatus, generateMemberPin, MemberContact } from '../services/provisioning';
interface SupabaseMember {
  id: string;
  first_name: string;
  last_name: string;
  department?: string;
  phone?: string;
  email?: string;
  status?: string;
}

interface SupabaseTransaction {
  id: number;
  date: string;
  category: string;
  type: 'Income' | 'Expense';
  amount: number;
  description?: string;
  member_id?: string;
  non_member_name?: string;
  is_anonymous?: boolean;
  member?: SupabaseMember | null;
}

function transformTransaction(SupabaseTx: SupabaseTransaction): Transaction {
  let contributorName: string | undefined;
  let contributorPhone: string | undefined;

  if (SupabaseTx.is_anonymous) {
    contributorName = 'Anonymous';
  } else if (SupabaseTx.member) {
    contributorName = `${SupabaseTx.member.first_name} ${SupabaseTx.member.last_name}`.trim();
    contributorPhone = SupabaseTx.member.phone;
  } else if (SupabaseTx.non_member_name) {
    contributorName = SupabaseTx.non_member_name;
  }

  return {
    id: SupabaseTx.id,
    date: SupabaseTx.date,
    category: SupabaseTx.category as TransactionCategory,
    type: SupabaseTx.type,
    amount: parseFloat(SupabaseTx.amount.toString()),
    description: SupabaseTx.description || '',
    memberId: SupabaseTx.member_id,
    nonMemberName: SupabaseTx.non_member_name,
    isAnonymous: SupabaseTx.is_anonymous || false,
    contributorName,
    contributorPhone,
  };
}

export function useTransactions() {
  const { data, loading, error, fetchMore } = useQuery(GET_TRANSACTIONS_QUERY, {
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  const pageInfo = data?.transactionsCollection?.pageInfo;
  const hasNextPage = !!pageInfo?.hasNextPage;
  const fetchNextPage = async () => {
    if (!hasNextPage || !pageInfo?.endCursor) return;
    await fetchMore({
      variables: {
        after: pageInfo.endCursor,
      },
    });
  };
  const apolloClient = useApolloClient();
  const [addTransactionMutation] = useMutation(ADD_TRANSACTION_MUTATION, {
    refetchQueries: [{ query: GET_TRANSACTIONS_QUERY }],
    awaitRefetchQueries: true,
  });
  const [updateTransactionMutation] = useMutation(UPDATE_TRANSACTION_MUTATION, {
    refetchQueries: [{ query: GET_TRANSACTIONS_QUERY }],
    awaitRefetchQueries: true,
  });
  const [deleteTransactionMutation] = useMutation(DELETE_TRANSACTION_MUTATION, {
    refetchQueries: [{ query: GET_TRANSACTIONS_QUERY }, { query: GET_MEMBERS_QUERY }],
    awaitRefetchQueries: true,
  });
  const [updateMemberMutation] = useMutation(UPDATE_MEMBER_MUTATION);
  const [addAuditLogMutation] = useMutation(ADD_AUDIT_LOG_MUTATION);
  const [addNotificationLogMutation] = useMutation(ADD_NOTIFICATION_LOG_MUTATION);
  const [addProvisioningQueueMutation] = useMutation(ADD_PROVISIONING_QUEUE_MUTATION);

  const transactions: Transaction[] = useMemo(() => {
    console.warn('[useTransactions] Query data:', data, 'Error:', error);
    if (!data?.transactionsCollection?.edges) {
      console.warn('[useTransactions] No transactions in data', { data, loading, error });
      return [];
    }
    console.warn('[useTransactions] Transactions count:', data.transactionsCollection.edges.length);
    return data.transactionsCollection.edges.map((edge: { node: SupabaseTransaction }) =>
      transformTransaction(edge.node),
    );
  }, [data, error, loading]);

  const addTransaction = async (transaction: Omit<Transaction, 'id'> | Transaction) => {
    console.warn('[useTransactions] addTransaction called', {
      date: transaction.date,
      category: transaction.category,
      type: transaction.type,
      amount: transaction.amount,
      memberId: transaction.memberId,
    });
    try {
      console.warn('[useTransactions] Sending GraphQL mutation...');
      const result = await addTransactionMutation({
        variables: {
          object: {
            date: transaction.date,
            category: transaction.category,
            type: transaction.type,
            amount: transaction.amount.toString(), // BigFloat requires string
            description: toTitleCase(transaction.description),
            member_id: transaction.memberId || null,
            non_member_name: toTitleCase(transaction.nonMemberName) || null,
            is_anonymous: transaction.isAnonymous || false,
          },
        },
      });

      console.warn('[useTransactions] Mutation result:', result);

      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map((e) => e.message).join('; ');
        console.error('[useTransactions] GraphQL errors:', result.errors);
        throw new Error(`Database error: ${errorMessages}`);
      }

      const insertedRecords = result.data?.insertIntotransactionsCollection?.records;
      if (!insertedRecords || insertedRecords.length === 0) {
        console.error('[useTransactions] No records returned from insert', { data: result.data });
        throw new Error('Transaction could not be saved. The database rejected the operation.');
      }

      // --- Payment-Gated Activation Logic ---
      if (transaction.category === 'Registration Fee' && transaction.memberId) {
        const previousRegistrationFees = transactions
          .filter((t) => t.memberId === transaction.memberId && t.category === 'Registration Fee')
          .reduce((sum, t) => sum + t.amount, 0);

        const totalRegistrationPaid = previousRegistrationFees + transaction.amount;

        if (totalRegistrationPaid >= 500) {
          console.warn('[useTransactions] Registration threshold met.');

          // Fetch member details to validate contact info before provisioning.
          // Members are already loaded into the Apollo cache at startup, so
          // use cache-first to avoid refetching the full member table here.
          const memberResult = await apolloClient.query({
            query: GET_MEMBERS_QUERY,
            fetchPolicy: 'cache-first',
          });

          const memberNode = memberResult.data?.membersCollection?.edges?.find(
            (e: { node: MemberContact }) => e.node.id === transaction.memberId,
          )?.node;

          const updatedTransactions = [...transactions, transaction];
          const status = computeRegistrationStatus(transaction.memberId, updatedTransactions, memberNode);

          if (!status.canProvision) {
            console.warn('[useTransactions] Provisioning blocked — missing contact details.');

            // Deduplicate: check if a queued entry already exists for this member
            const existingQueue = await apolloClient.query({
              query: GET_PROVISIONING_QUEUE_QUERY,
              fetchPolicy: 'network-only',
            });
            const existingEntries = existingQueue.data?.provisioning_queueCollection?.edges?.filter(
              (e: { node: { member_id: string; status: string } }) =>
                e.node.member_id === transaction.memberId && e.node.status === 'queued',
            );

            if (!existingEntries || existingEntries.length === 0) {
              await addProvisioningQueueMutation({
                variables: {
                  object: {
                    member_id: transaction.memberId,
                    status: 'queued',
                    reason: `Missing: ${status.missingFields.join(', ')}`,
                    retry_count: 0,
                    next_retry_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  },
                },
              });
            } else {
              console.warn('[useTransactions] Queue entry already exists for member — skipping deduplicate insert.');
            }

            try {
              await addAuditLogMutation({
                variables: {
                  object: {
                    action: 'Provisioning Blocked',
                    entity_type: 'member',
                    entity_id: transaction.memberId,
                    details: {
                      reason: 'Missing contact details',
                      missing: status.missingFields,
                      total_paid: totalRegistrationPaid,
                      queued: true,
                    },
                  },
                },
              });
            } catch (auditErr) {
              console.error('Failed to write audit log', auditErr);
            }
          } else {
            console.warn('[useTransactions] Contact details valid. Activating member portal...');

            const { pin: generatedPin, hashedPin } = await generateMemberPin(transaction.memberId!);

            console.warn('[useTransactions] Executing updateMemberMutation for top-up...', {
              id: transaction.memberId,
              status: 'Active',
            });
            const updateRes = await updateMemberMutation({
              variables: {
                id: transaction.memberId,
                updates: {
                  status: 'Active',
                  pin: hashedPin,
                  is_portal_active: true,
                },
              },
            });
            console.warn('[useTransactions] Top-up update response:', updateRes);
            if (updateRes.errors && updateRes.errors.length > 0) {
              console.error('[useTransactions] Error updating member for top-up:', updateRes.errors);
              throw new Error(
                'Database error activating member portal: ' + updateRes.errors.map((e) => e.message).join(', '),
              );
            } else if (updateRes.data?.updatemembersCollection?.records?.length === 0) {
              console.error(
                '[useTransactions] Top-up mutation returned 0 records! The member ID was not found or RLS blocked it.',
                transaction.memberId,
              );
              throw new Error(
                `Failed to activate member portal: Member ID ${transaction.memberId} not found or blocked.`,
              );
            }
            console.warn('[useTransactions] Member activated with new PIN.');

            try {
              await addAuditLogMutation({
                variables: {
                  object: {
                    action: 'Member Activated',
                    entity_type: 'member',
                    entity_id: transaction.memberId,
                    details: { reason: 'Registration threshold met', amount: totalRegistrationPaid },
                  },
                },
              });
            } catch (auditErr) {
              console.error('Failed to write audit log', auditErr);
            }

            if (memberNode) {
              const memberName = `${memberNode.first_name} ${memberNode.last_name}`.trim();
              const emailTier = memberNode.email_tier || 'member';
              let orgEmail = memberNode.org_email;

              if (!orgEmail) {
                const config = loadImprovMXConfig();
                const baseEmail = generateOrgEmail(memberName, config.domain || 'hkmministries.org');
                orgEmail = baseEmail;

                if (config.apiKey) {
                  let isUnique = false;
                  let attempts = 0;
                  while (!isUnique && attempts < 5) {
                    const checkResult = await checkAliasExists(orgEmail);
                    if (!checkResult.exists) {
                      isUnique = true;
                    } else {
                      const randomDigits = Math.floor(100 + Math.random() * 900);
                      const parts = baseEmail.split('@');
                      orgEmail = `${parts[0]}.${randomDigits}@${parts[1]}`;
                    }
                    attempts++;
                  }
                }

                if (emailTier === 'member') {
                  const aliasResult = await createAlias(orgEmail, memberNode.email || '');
                  if (aliasResult.success) {
                    await updateMemberMutation({
                      variables: {
                        id: transaction.memberId,
                        updates: { org_email: orgEmail },
                      },
                    });
                    console.warn(`[useTransactions] Org email ${orgEmail} created and saved.`);
                  } else {
                    console.error('[useTransactions] Failed to create alias:', aliasResult.error);
                  }
                } else if (emailTier === 'leadership') {
                  try {
                    await addAuditLogMutation({
                      variables: {
                        object: {
                          action: 'Leadership Email Required',
                          entity_type: 'member',
                          entity_id: transaction.memberId,
                          details: {
                            note: 'Leadership member — set up Google Workspace Gmail manually',
                            org_email: orgEmail,
                          },
                        },
                      },
                    });
                  } catch (auditErr) {
                    console.error('Failed to write audit log for leadership email notice', auditErr);
                  }
                }
              }

              const notifResult = await sendPinNotification({
                memberId: memberNode.id,
                memberName,
                phone: memberNode.phone,
                email: memberNode.email,
                pin: generatedPin,
                orgEmail: orgEmail,
              });

              try {
                await addNotificationLogMutation({
                  variables: {
                    object: {
                      member_id: memberNode.id,
                      channel: 'sms',
                      recipient: memberNode.phone || 'None',
                      status: notifResult.sms.sent ? 'success' : 'failed',
                      error_message: notifResult.sms.error || null,
                    },
                  },
                });
              } catch (err) {
                console.error('Failed to log SMS notif', err);
              }

              try {
                await addNotificationLogMutation({
                  variables: {
                    object: {
                      member_id: memberNode.id,
                      channel: 'email',
                      recipient: memberNode.email || 'None',
                      status: notifResult.email.sent ? 'success' : 'failed',
                      error_message: notifResult.email.error || null,
                    },
                  },
                });
              } catch (err) {
                console.error('Failed to log Email notif', err);
              }
            } else {
              console.warn('[useTransactions] Could not find member details for PIN notification.');
            }
          }
        } else {
          console.warn(
            `[useTransactions] Partial Registration Fee. Total paid: ${totalRegistrationPaid}. Pending 500 threshold.`,
          );
          try {
            await addAuditLogMutation({
              variables: {
                object: {
                  action: 'Partial Fee Paid',
                  entity_type: 'member',
                  entity_id: transaction.memberId,
                  details: { amount_paid: transaction.amount, total_paid: totalRegistrationPaid },
                },
              },
            });
          } catch (auditErr) {
            console.error('Failed to write audit log', auditErr);
          }
        }
      }

      console.warn('[useTransactions] Mutation succeeded');
    } catch (error: unknown) {
      console.error('[useTransactions] Error adding transaction:', error);
      const graphQLError =
        error instanceof Error && 'graphQLErrors' in error
          ? (error as { graphQLErrors?: Array<{ message?: string }> }).graphQLErrors?.[0]?.message
          : undefined;
      const msg = error instanceof Error ? error.message : String(error);
      const message = graphQLError || msg || 'Failed to save transaction. Please check your connection and try again.';
      console.error('[useTransactions] Throwing error:', message);
      throw new Error(message, { cause: error });
    }
  };

  const updateTransaction = async (id: number, updates: Partial<Transaction>) => {
    try {
      const payload: Record<string, unknown> = {};
      if (updates.date !== undefined) payload.date = updates.date;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.amount !== undefined) payload.amount = updates.amount.toString();
      if (updates.description !== undefined) payload.description = toTitleCase(updates.description);
      if (updates.memberId !== undefined) payload.member_id = updates.memberId || null;
      if (updates.nonMemberName !== undefined) payload.non_member_name = toTitleCase(updates.nonMemberName) || null;
      if (updates.isAnonymous !== undefined) payload.is_anonymous = updates.isAnonymous;

      const result = await updateTransactionMutation({
        variables: {
          id,
          updates: payload,
        },
      });

      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map((e) => e.message).join('; ');
        throw new Error(`Database error: ${errorMessages}`);
      }

      const updatedRecords = result.data?.updatetransactionsCollection?.records;
      if (!updatedRecords || updatedRecords.length === 0) {
        throw new Error('Transaction could not be updated. The database rejected the operation.');
      }

      // Real-time subscription will update UI automatically
    } catch (error: unknown) {
      console.error('Error updating transaction:', error);
      const graphQLError =
        error instanceof Error && 'graphQLErrors' in error
          ? (error as { graphQLErrors?: Array<{ message?: string }> }).graphQLErrors?.[0]?.message
          : undefined;
      const msg = error instanceof Error ? error.message : String(error);
      const message =
        graphQLError || msg || 'Failed to update transaction. Please check your connection and try again.';
      throw new Error(message, { cause: error });
    }
  };

  const deleteTransaction = async (id: number, transaction?: Transaction) => {
    try {
      const result = await deleteTransactionMutation({
        variables: { id },
      });

      if (!result.data?.deleteFromtransactionsCollection?.records?.length) {
        throw new Error('Failed to delete transaction - no data returned');
      }

      // If deleting a Registration Fee, recalculate member's registration status
      if (transaction?.category === 'Registration Fee' && transaction?.memberId) {
        const remainingTotal = transactions
          .filter((t) => t.memberId === transaction.memberId! && t.category === 'Registration Fee' && t.id !== id)
          .reduce((sum, t) => sum + t.amount, 0);

        if (remainingTotal < 500) {
          const updateRes = await updateMemberMutation({
            variables: {
              id: transaction.memberId,
              updates: {
                status: 'Pending Fee',
                pin: null,
                is_portal_active: false,
                org_email: null,
              },
            },
          });

          console.warn('[useTransactions] Downgrade mutation response:', updateRes);

          if (updateRes.errors && updateRes.errors.length > 0) {
            console.error('Error downgrading member status:', updateRes.errors);
            throw new Error(
              'Database error downgrading member status: ' + updateRes.errors.map((e) => e.message).join(', '),
            );
          } else if (updateRes.data?.updatemembersCollection?.records?.length === 0) {
            console.error(
              '[useTransactions] Downgrade mutation returned 0 records! The member ID was not found or RLS blocked it.',
              transaction.memberId,
            );
            throw new Error(
              `Failed to downgrade member status: Member ID ${transaction.memberId} not found or blocked.`,
            );
          } else {
            console.warn(`[useTransactions] Successfully downgraded member ${transaction.memberId} to Pending Fee.`);
          }

          try {
            await addAuditLogMutation({
              variables: {
                object: {
                  action: 'Registration Reverted',
                  entity_type: 'member',
                  entity_id: transaction.memberId,
                  details: {
                    reason: 'Registration Fee transaction deleted',
                    remaining_total: remainingTotal,
                    new_status: 'Pending Fee',
                  },
                },
              },
            });
          } catch (auditErr) {
            console.error('Failed to write audit log', auditErr);
          }
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error deleting transaction:', error);
      throw new Error(msg || 'Failed to delete transaction. Please check your connection and try again.', {
        cause: error,
      });
    }
  };

  // Check if there's a connection error
  const connectionError = error
    ? 'Database connection failed. Please check your network connection and ensure the database server is running.'
    : null;

  return {
    data: transactions,
    setData: (_newTransactions: Transaction[]) => {
      console.warn('setData called on Supabase subscription - data is managed by GraphQL');
    },
    loading,
    error: error || connectionError,
    hasNextPage,
    fetchNextPage,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
