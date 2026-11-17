import { gql } from '@apollo/client';

// SECURITY NOTE: This query compares the PBKDF2 hash client-side generated hash
// against the stored hash in the database. While hashing is now PBKDF2 with
// 600,000 iterations, the pass-the-hash risk remains: an attacker with DB access
// can login with the stored hash directly.
// MITIGATION: PIN hashes are derived from memberId + pin with PBKDF2 (not raw SHA-256).
// FUTURE: Replace with a Supabase Edge Function (RPC) that performs the comparison
// server-side and adds a server-generated salt layer.
export const PORTAL_LOGIN_QUERY = gql`
  query PortalLogin($id: String!, $pin: String!) {
    membersCollection(filter: { id: { eq: $id }, pin: { eq: $pin }, is_portal_active: { eq: true } }, first: 1) {
      edges {
        node {
          id
          first_name
          last_name
          email
          phone
          department
          status
          joined_at
          is_portal_active
        }
      }
    }
  }
`;

export const GET_MEMBER_DASHBOARD_QUERY = gql`
  query GetMemberDashboard($memberId: String!) {
    membersCollection(filter: { id: { eq: $memberId } }, first: 1) {
      edges {
        node {
          id
          first_name
          last_name
          email
          phone
          department
          status
          joined_at
          gender
          marital_status
          address
          occupation
          dob
          is_portal_active
          avatar
        }
      }
    }
    transactionsCollection(
      filter: { member_id: { eq: $memberId }, type: { eq: "Income" } }
      orderBy: [{ date: DescNullsLast }]
    ) {
      edges {
        node {
          id
          date
          category
          amount
          description
        }
      }
    }
    attendance_recordsCollection(filter: { member_id: { eq: $memberId } }, orderBy: [{ date: DescNullsLast }]) {
      edges {
        node {
          id
          date
          service
          status
        }
      }
    }
  }
`;

export const GET_MEMBER_PROFILE_QUERY = gql`
  query GetMemberProfile($memberId: String!) {
    membersCollection(filter: { id: { eq: $memberId } }, first: 1) {
      edges {
        node {
          id
          first_name
          last_name
          email
          phone
          address
          occupation
          marital_status
          dob
        }
      }
    }
  }
`;

export const UPDATE_MEMBER_PROFILE_MUTATION = gql`
  mutation UpdateMemberProfile($id: String!, $updates: membersUpdateInput!) {
    updatemembersCollection(filter: { id: { eq: $id } }, set: $updates) {
      records {
        id
      }
    }
  }
`;

export const SUBMIT_HELPDESK_TICKET_MUTATION = gql`
  mutation SubmitHelpdeskTicket($sender_id: String!, $department: String, $subject: String!, $body: String!) {
    insertIntomessagesCollection(
      objects: [{ sender_id: $sender_id, department: $department, subject: $subject, body: $body, status: "unread" }]
    ) {
      records {
        id
      }
    }
  }
`;

export const GET_CHURCH_SETTINGS_QUERY = gql`
  query GetChurchSettings {
    church_settingsCollection(first: 1) {
      edges {
        node {
          id
          name
          address
          phone
          email
          website
          logo_url
        }
      }
    }
  }
`;

export const UPSERT_CHURCH_SETTINGS_MUTATION = gql`
  mutation UpsertChurchSettings(
    $id: Int!
    $name: String!
    $address: String
    $phone: String
    $email: String
    $website: String
    $logo_url: String
  ) {
    upsertIntochurch_settingsCollection(
      objects: [
        {
          id: $id
          name: $name
          address: $address
          phone: $phone
          email: $email
          website: $website
          logo_url: $logo_url
        }
      ]
      onConflict: { constraint: church_settings_pkey, updateColumns: [name, address, phone, email, website, logo_url] }
    ) {
      records {
        id
        name
      }
    }
  }
`;
