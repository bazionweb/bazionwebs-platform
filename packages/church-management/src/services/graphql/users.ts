import { gql } from '@apollo/client';

export const GET_USERS_QUERY = gql`
  query GetUsers {
    usersCollection(first: 10000, orderBy: [{ username: AscNullsLast }]) {
      edges {
        node {
          id
          username
          email
          role
          avatar
          last_login
          created_at
        }
      }
    }
  }
`;

export const GET_USERS_SUBSCRIPTION = gql`
  subscription GetUsers {
    usersCollection(orderBy: [{ username: AscNullsLast }]) {
      edges {
        node {
          id
          username
          email
          role
          avatar
          last_login
          created_at
        }
      }
    }
  }
`;

export const UPSERT_USER_MUTATION = gql`
  mutation UpsertUser($object: usersInsertInput!) {
    insertIntousersCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const UPDATE_USER_MUTATION = gql`
  mutation UpdateUser($id: String!, $changes: usersUpdateInput!) {
    updateusersCollection(filter: { id: { eq: $id } }, set: $changes) {
      records {
        id
      }
    }
  }
`;

export const GET_USER_QUERY = gql`
  query GetUser($id: String!) {
    usersCollection(filter: { id: { eq: $id } }) {
      edges {
        node {
          id
          username
          email
          role
          avatar
          last_login
          created_at
        }
      }
    }
  }
`;

export const DELETE_USER_MUTATION = gql`
  mutation DeleteUser($id: String!) {
    deleteFromusersCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;
