import { gql } from '@apollo/client';

// ─── Recycle Bin ────────────────────────────────────────────────
export const GET_RECYCLE_BIN_QUERY = gql`
  query GetRecycleBin {
    recycle_binCollection(first: 10000, orderBy: [{ deleted_at: DescNullsLast }]) {
      edges {
        node {
          id
          original_id
          type
          data
          deleted_by
          deleted_at
          reason
        }
      }
    }
  }
`;

export const GET_RECYCLE_BIN_SUBSCRIPTION = gql`
  subscription GetRecycleBin {
    recycle_binCollection(orderBy: [{ deleted_at: DescNullsLast }]) {
      edges {
        node {
          id
          original_id
          type
          data
          deleted_by
          deleted_at
          reason
        }
      }
    }
  }
`;

export const ADD_RECYCLE_BIN_MUTATION = gql`
  mutation AddRecycleBin($object: recycle_binInsertInput!) {
    insertIntorecycle_binCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const DELETE_RECYCLE_BIN_MUTATION = gql`
  mutation DeleteRecycleBin($id: String!) {
    deleteFromrecycle_binCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;

// ─── Permission Requests ────────────────────────────────────────
export const GET_PERMISSION_REQUESTS_QUERY = gql`
  query GetPermissionRequests {
    permission_requestsCollection(first: 10000, orderBy: [{ requested_at: DescNullsLast }]) {
      edges {
        node {
          id
          requester_id
          requester_name
          requester_email
          request_type
          data_type
          data_id
          data_name
          reason
          requested_at
          status
          reviewed_by
          reviewed_at
          review_notes
          expires_at
        }
      }
    }
  }
`;

export const GET_PERMISSION_REQUESTS_SUBSCRIPTION = gql`
  subscription GetPermissionRequests {
    permission_requestsCollection(orderBy: [{ requested_at: DescNullsLast }]) {
      edges {
        node {
          id
          requester_id
          requester_name
          requester_email
          request_type
          data_type
          data_id
          data_name
          reason
          requested_at
          status
          reviewed_by
          reviewed_at
          review_notes
          expires_at
        }
      }
    }
  }
`;

export const ADD_PERMISSION_REQUEST_MUTATION = gql`
  mutation AddPermissionRequest($object: permission_requestsInsertInput!) {
    insertIntopermission_requestsCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const UPDATE_PERMISSION_REQUEST_MUTATION = gql`
  mutation UpdatePermissionRequest($id: String!, $changes: permission_requestsUpdateInput!) {
    updatepermission_requestsCollection(filter: { id: { eq: $id } }, set: $changes) {
      records {
        id
      }
    }
  }
`;

export const DELETE_PERMISSION_REQUEST_MUTATION = gql`
  mutation DeletePermissionRequest($id: String!) {
    deleteFrompermission_requestsCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;

// ─── User Sessions ──────────────────────────────────────────────
export const GET_USER_SESSIONS_QUERY = gql`
  query GetUserSessions($startDate: Datetime!) {
    user_sessionsCollection(
      filter: { login_time: { gte: $startDate } }
      first: 10000
      orderBy: [{ login_time: DescNullsLast }]
    ) {
      edges {
        node {
          id
          user_id
          user_email
          user_name
          user_role
          login_time
          logout_time
          is_active
          ip_address
          user_agent
          location
          session_duration
          last_activity
        }
      }
    }
  }
`;

export const GET_USER_SESSIONS_SUBSCRIPTION = gql`
  subscription GetUserSessions($startDate: Datetime!) {
    user_sessionsCollection(filter: { login_time: { gte: $startDate } }, orderBy: [{ login_time: DescNullsLast }]) {
      edges {
        node {
          id
          user_id
          user_email
          user_name
          user_role
          login_time
          logout_time
          is_active
          ip_address
          user_agent
          location
          session_duration
          last_activity
        }
      }
    }
  }
`;

export const ADD_USER_SESSION_MUTATION = gql`
  mutation AddUserSession($object: user_sessionsInsertInput!) {
    insertIntouser_sessionsCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const UPDATE_USER_SESSION_MUTATION = gql`
  mutation UpdateUserSession($id: String!, $changes: user_sessionsUpdateInput!) {
    updateuser_sessionsCollection(filter: { id: { eq: $id } }, set: $changes) {
      records {
        id
      }
    }
  }
`;

export const END_USER_SESSION_MUTATION = gql`
  mutation EndUserSession($id: String!, $logout_time: Datetime!) {
    updateuser_sessionsCollection(filter: { id: { eq: $id } }, set: { logout_time: $logout_time, is_active: false }) {
      records {
        id
      }
    }
  }
`;

// ─── Login Attempts ─────────────────────────────────────────────
export const GET_LOGIN_ATTEMPTS_QUERY = gql`
  query GetLoginAttempts($startDate: Datetime!) {
    login_attemptsCollection(
      filter: { timestamp: { gte: $startDate } }
      first: 10000
      orderBy: [{ timestamp: DescNullsLast }]
    ) {
      edges {
        node {
          id
          email
          timestamp
          success
          failure_reason
          ip_address
          user_agent
          location
        }
      }
    }
  }
`;

export const GET_LOGIN_ATTEMPTS_SUBSCRIPTION = gql`
  subscription GetLoginAttempts($startDate: Datetime!) {
    login_attemptsCollection(filter: { timestamp: { gte: $startDate } }, orderBy: [{ timestamp: DescNullsLast }]) {
      edges {
        node {
          id
          email
          timestamp
          success
          failure_reason
          ip_address
          user_agent
          location
        }
      }
    }
  }
`;

export const ADD_LOGIN_ATTEMPT_MUTATION = gql`
  mutation AddLoginAttempt($object: login_attemptsInsertInput!) {
    insertIntologin_attemptsCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;
