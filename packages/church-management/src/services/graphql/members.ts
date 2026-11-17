import { gql } from '@apollo/client';

// Supabase pg_graphql uses Relay-style collections
// pg_graphql defaults to 30 rows if no `first:` arg is given.
// 10000 covers any realistic church roster while still returning the full
// dataset in a single round-trip so the dashboard and directory show
// every member in the database.
export const GET_MEMBERS_QUERY = gql`
  query GetMembers($first: Int = 10000, $after: Cursor) {
    membersCollection(first: $first, after: $after, orderBy: [{ created_at: DescNullsLast }]) {
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
          first_name
          last_name
          title
          email
          phone
          department
          status
          dob
          gender
          avatar
          avatar_transform
          address
          joined_at
          created_at
          occupation
          marital_status
          pin
          is_portal_active
          email_tier
          org_email
        }
      }
    }
  }
`;

export const GET_MEMBERS_SUBSCRIPTION = gql`
  subscription GetMembers {
    membersCollection(first: 10000, orderBy: [{ created_at: DescNullsLast }]) {
      edges {
        node {
          id
          first_name
          last_name
          title
          email
          phone
          department
          status
          dob
          gender
          avatar
          avatar_transform
          address
          joined_at
          created_at
          occupation
          marital_status
          pin
          is_portal_active
          email_tier
          org_email
        }
      }
    }
  }
`;

export const ADD_MEMBER_MUTATION = gql`
  mutation AddMember($object: membersInsertInput!) {
    insertIntomembersCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const UPDATE_MEMBER_MUTATION = gql`
  mutation UpdateMember($id: String!, $updates: membersUpdateInput!) {
    updatemembersCollection(filter: { id: { eq: $id } }, set: $updates) {
      records {
        id
        status
        pin
        is_portal_active
        org_email
      }
    }
  }
`;

export const DELETE_MEMBER_MUTATION = gql`
  mutation DeleteMember($id: String!) {
    deleteFrommembersCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;
