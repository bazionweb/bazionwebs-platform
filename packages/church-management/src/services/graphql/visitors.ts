import { gql } from '@apollo/client';

export const GET_VISITORS_QUERY = gql`
  query GetVisitors {
    visitorsCollection(first: 10000, orderBy: [{ registered_date: DescNullsLast }]) {
      edges {
        node {
          id
          name
          initials
          phone
          email
          heard_from
          first_visit
          registered_date
          status
          follow_upsCollection(orderBy: [{ date: DescNullsLast }]) {
            edges {
              node {
                id
                visitor_id
                date
                interaction_type
                notes
                next_follow_up_date
                outcome
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_VISITORS_SUBSCRIPTION = gql`
  subscription GetVisitors {
    visitorsCollection(orderBy: [{ registered_date: DescNullsLast }]) {
      edges {
        node {
          id
          name
          initials
          phone
          email
          heard_from
          first_visit
          registered_date
          status
          follow_upsCollection(orderBy: [{ date: DescNullsLast }]) {
            edges {
              node {
                id
                visitor_id
                date
                interaction_type
                notes
                next_follow_up_date
                outcome
              }
            }
          }
        }
      }
    }
  }
`;

export const ADD_VISITOR_MUTATION = gql`
  mutation AddVisitor($object: visitorsInsertInput!) {
    insertIntovisitorsCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const UPDATE_VISITOR_MUTATION = gql`
  mutation UpdateVisitor($id: Int!, $_set: visitorsUpdateInput!) {
    updatevisitorsCollection(filter: { id: { eq: $id } }, set: $_set) {
      records {
        id
      }
    }
  }
`;

export const DELETE_VISITOR_MUTATION = gql`
  mutation DeleteVisitor($id: Int!) {
    deleteFromvisitorsCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;

export const ADD_FOLLOW_UP_MUTATION = gql`
  mutation AddFollowUp($object: follow_upsInsertInput!) {
    insertIntofollow_upsCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const UPDATE_FOLLOW_UP_MUTATION = gql`
  mutation UpdateFollowUp($id: Int!, $_set: follow_upsUpdateInput!) {
    updatefollow_upsCollection(filter: { id: { eq: $id } }, set: $_set) {
      records {
        id
      }
    }
  }
`;

export const DELETE_FOLLOW_UP_MUTATION = gql`
  mutation DeleteFollowUp($id: Int!) {
    deleteFromfollow_upsCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;
