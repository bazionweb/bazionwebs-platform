import { gql } from '@apollo/client';

export const GET_BRANCHES_QUERY = gql`
  query GetBranches {
    branchesCollection(first: 10000, orderBy: [{ name: AscNullsLast }]) {
      edges {
        node {
          id
          name
          location
          manager_id
          phone
          email
          is_active
          created_at
          updated_at
        }
      }
    }
  }
`;

export const GET_BRANCHES_SUBSCRIPTION = gql`
  subscription GetBranches {
    branchesCollection(orderBy: [{ name: AscNullsLast }]) {
      edges {
        node {
          id
          name
          location
          manager_id
          phone
          email
          is_active
          created_at
          updated_at
        }
      }
    }
  }
`;

export const ADD_BRANCH_MUTATION = gql`
  mutation AddBranch($object: branchesInsertInput!) {
    insertIntobranchesCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const UPDATE_BRANCH_MUTATION = gql`
  mutation UpdateBranch($id: Int!, $changes: branchesUpdateInput!) {
    updatebranchesCollection(filter: { id: { eq: $id } }, set: $changes) {
      records {
        id
      }
    }
  }
`;

export const DELETE_BRANCH_MUTATION = gql`
  mutation DeleteBranch($id: Int!) {
    deleteFrombranchesCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;
