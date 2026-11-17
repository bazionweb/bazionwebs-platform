import { gql } from '@apollo/client';

export const GET_MESSAGES_QUERY = gql`
  query GetMessages {
    messagesCollection(first: 10000, orderBy: [{ created_at: DescNullsLast }]) {
      edges {
        node {
          id
          sender_id
          receiver_id
          department
          subject
          body
          status
          created_at
          updated_at
        }
      }
    }
  }
`;

export const GET_MESSAGES_SUBSCRIPTION = gql`
  subscription GetMessages {
    messagesCollection(orderBy: [{ created_at: DescNullsLast }]) {
      edges {
        node {
          id
          sender_id
          receiver_id
          department
          subject
          body
          status
          created_at
          updated_at
        }
      }
    }
  }
`;

export const ADD_MESSAGE_MUTATION = gql`
  mutation AddMessage($object: messagesInsertInput!) {
    insertIntomessagesCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const UPDATE_MESSAGE_MUTATION = gql`
  mutation UpdateMessage($id: Int!, $updates: messagesUpdateInput!) {
    updatemessagesCollection(filter: { id: { eq: $id } }, set: $updates) {
      records {
        id
      }
    }
  }
`;

export const DELETE_MESSAGE_MUTATION = gql`
  mutation DeleteMessage($id: Int!) {
    deleteFrommessagesCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;
