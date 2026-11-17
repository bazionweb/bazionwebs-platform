import { gql } from '@apollo/client';

export const GET_TRANSACTIONS_QUERY = gql`
  query GetTransactions($first: Int = 10000, $after: Cursor) {
    transactionsCollection(first: $first, after: $after, orderBy: [{ created_at: DescNullsLast }]) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          id
          date
          category
          type
          amount
          description
          member_id
          non_member_name
          is_anonymous
          created_at
          updated_at
        }
      }
    }
  }
`;

export const GET_TRANSACTIONS_SUBSCRIPTION = gql`
  subscription GetTransactions($startDate: Date!) {
    transactionsCollection(filter: { date: { gte: $startDate } }, orderBy: [{ created_at: DescNullsLast }]) {
      edges {
        node {
          id
          date
          category
          type
          amount
          description
          member_id
          non_member_name
          is_anonymous
          created_at
          updated_at
        }
      }
    }
  }
`;

export const ADD_TRANSACTION_MUTATION = gql`
  mutation AddTransaction($object: transactionsInsertInput!) {
    insertIntotransactionsCollection(objects: [$object]) {
      records {
        id
        member_id
      }
    }
  }
`;

export const UPDATE_TRANSACTION_MUTATION = gql`
  mutation UpdateTransaction($id: Int!, $updates: transactionsUpdateInput!) {
    updatetransactionsCollection(filter: { id: { eq: $id } }, set: $updates) {
      records {
        id
        member_id
      }
    }
  }
`;

export const DELETE_TRANSACTION_MUTATION = gql`
  mutation DeleteTransaction($id: Int!) {
    deleteFromtransactionsCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;

export const ADD_NOTIFICATION_LOG_MUTATION = gql`
  mutation AddNotificationLog($object: notification_logsInsertInput!) {
    insertIntonotification_logsCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const ADD_AUDIT_LOG_MUTATION = gql`
  mutation AddAuditLog($object: audit_logsInsertInput!) {
    insertIntoaudit_logsCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;
