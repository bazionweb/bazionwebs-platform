import { gql } from '@apollo/client';

export const GET_PROVISIONING_QUEUE_QUERY = gql`
  query GetProvisioningQueue {
    provisioning_queueCollection(first: 10000, orderBy: [{ created_at: DescNullsLast }]) {
      edges {
        node {
          id
          member_id
          status
          reason
          retry_count
          next_retry_at
          created_at
          updated_at
        }
      }
    }
  }
`;

export const ADD_PROVISIONING_QUEUE_MUTATION = gql`
  mutation AddProvisioningQueue($object: provisioning_queueInsertInput!) {
    insertIntoprovisioning_queueCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const UPDATE_PROVISIONING_QUEUE_MUTATION = gql`
  mutation UpdateProvisioningQueue($id: String!, $updates: provisioning_queueUpdateInput!) {
    updateProvisioning_queueCollection(filter: { id: { eq: $id } }, set: $updates) {
      records {
        id
      }
    }
  }
`;

export const DELETE_PROVISIONING_QUEUE_MUTATION = gql`
  mutation DeleteProvisioningQueue($id: String!) {
    deleteFromprovisioning_queueCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;
