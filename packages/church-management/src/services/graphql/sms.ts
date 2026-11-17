import { gql } from '@apollo/client';

export const GET_SMS_QUERY = gql`
  query GetSmsRecords($startDate: Date!) {
    sms_recordsCollection(filter: { date: { gte: $startDate } }, first: 10000, orderBy: [{ date: DescNullsLast }]) {
      edges {
        node {
          id
          recipient_count
          message
          status
          date
        }
      }
    }
  }
`;

export const GET_SMS_SUBSCRIPTION = gql`
  subscription GetSmsRecords($startDate: Date!) {
    sms_recordsCollection(filter: { date: { gte: $startDate } }, orderBy: [{ date: DescNullsLast }]) {
      edges {
        node {
          id
          recipient_count
          message
          status
          date
        }
      }
    }
  }
`;

export const ADD_SMS_MUTATION = gql`
  mutation AddSmsRecord($object: sms_recordsInsertInput!) {
    insertIntosms_recordsCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const DELETE_SMS_MUTATION = gql`
  mutation DeleteSmsRecord($id: Int!) {
    deleteFromsms_recordsCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;
