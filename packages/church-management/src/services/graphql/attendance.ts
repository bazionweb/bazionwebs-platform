import { gql } from '@apollo/client';

export const GET_ATTENDANCE_QUERY = gql`
  query GetAttendance($first: Int = 10000, $after: Cursor) {
    attendance_recordsCollection(first: $first, after: $after, orderBy: [{ date: DescNullsLast }]) {
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
          date
          service
          member_id
          status
          members {
            first_name
            last_name
          }
        }
      }
    }
  }
`;

export const GET_ATTENDANCE_SUBSCRIPTION = gql`
  subscription GetAttendance($startDate: Date!) {
    attendance_recordsCollection(filter: { date: { gte: $startDate } }, orderBy: [{ date: DescNullsLast }]) {
      edges {
        node {
          id
          date
          service
          member_id
          status
          members {
            first_name
            last_name
          }
        }
      }
    }
  }
`;

export const ADD_ATTENDANCE_MUTATION = gql`
  mutation AddAttendanceRecords($objects: [attendance_recordsInsertInput!]!) {
    insertIntoattendance_recordsCollection(objects: $objects) {
      records {
        id
      }
    }
  }
`;

export const DELETE_ATTENDANCE_MUTATION = gql`
  mutation DeleteAttendanceRecord($id: Int!) {
    deleteFromattendance_recordsCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;

export const DELETE_ATTENDANCE_BY_SERVICE_MUTATION = gql`
  mutation DeleteAttendanceByService($date: Date!, $service: String!) {
    deleteFromattendance_recordsCollection(filter: { date: { eq: $date }, service: { eq: $service } }) {
      records {
        id
      }
    }
  }
`;
