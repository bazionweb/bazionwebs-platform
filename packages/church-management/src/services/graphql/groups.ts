import { gql } from '@apollo/client';

export const GET_GROUPS_QUERY = gql`
  query GetGroups {
    groupsCollection(first: 10000, orderBy: [{ name: AscNullsLast }]) {
      edges {
        node {
          id
          name
          leader_id
          member_count
          created_at
          category
          members {
            first_name
            last_name
            email
          }
        }
      }
    }
  }
`;

export const GET_GROUPS_SUBSCRIPTION = gql`
  subscription GetGroups {
    groupsCollection(orderBy: [{ name: AscNullsLast }]) {
      edges {
        node {
          id
          name
          leader_id
          member_count
          created_at
          category
          members {
            first_name
            last_name
            email
          }
        }
      }
    }
  }
`;

export const ADD_GROUP_MUTATION = gql`
  mutation AddGroup($object: groupsInsertInput!) {
    insertIntogroupsCollection(objects: [$object]) {
      records {
        id
        name
        category
      }
    }
  }
`;

export const UPDATE_GROUP_MUTATION = gql`
  mutation UpdateGroup($id: Int!, $_set: groupsUpdateInput!) {
    updategroupsCollection(filter: { id: { eq: $id } }, set: $_set) {
      records {
        id
        name
        category
      }
    }
  }
`;

export const DELETE_GROUP_MUTATION = gql`
  mutation DeleteGroup($id: Int!) {
    deleteFromgroupsCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;
