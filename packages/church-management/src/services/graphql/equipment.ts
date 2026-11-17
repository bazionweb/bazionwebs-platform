import { gql } from '@apollo/client';

export const GET_EQUIPMENT_QUERY = gql`
  query GetEquipment {
    equipmentCollection(first: 10000, orderBy: [{ name: AscNullsLast }]) {
      edges {
        node {
          id
          name
          category
          purchase_date
          purchase_price
          condition
          location
          description
          maintenance_recordsCollection(orderBy: [{ date: DescNullsLast }]) {
            edges {
              node {
                id
                equipment_id
                date
                type
                cost
                description
                status
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_EQUIPMENT_SUBSCRIPTION = gql`
  subscription GetEquipment {
    equipmentCollection(orderBy: [{ name: AscNullsLast }]) {
      edges {
        node {
          id
          name
          category
          purchase_date
          purchase_price
          condition
          location
          description
          maintenance_recordsCollection(orderBy: [{ date: DescNullsLast }]) {
            edges {
              node {
                id
                equipment_id
                date
                type
                cost
                description
                status
              }
            }
          }
        }
      }
    }
  }
`;

export const ADD_EQUIPMENT_MUTATION = gql`
  mutation AddEquipment($object: equipmentInsertInput!) {
    insertIntoequipmentCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const UPDATE_EQUIPMENT_MUTATION = gql`
  mutation UpdateEquipment($id: Int!, $_set: equipmentUpdateInput!) {
    updateequipmentCollection(filter: { id: { eq: $id } }, set: $_set) {
      records {
        id
      }
    }
  }
`;

export const DELETE_EQUIPMENT_MUTATION = gql`
  mutation DeleteEquipment($id: Int!) {
    deleteFromequipmentCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;

export const ADD_MAINTENANCE_MUTATION = gql`
  mutation AddMaintenance($object: maintenance_recordsInsertInput!) {
    insertIntomaintenance_recordsCollection(objects: [$object]) {
      records {
        id
      }
    }
  }
`;

export const UPDATE_MAINTENANCE_MUTATION = gql`
  mutation UpdateMaintenance($id: Int!, $_set: maintenance_recordsUpdateInput!) {
    updatemaintenance_recordsCollection(filter: { id: { eq: $id } }, set: $_set) {
      records {
        id
      }
    }
  }
`;

export const DELETE_MAINTENANCE_MUTATION = gql`
  mutation DeleteMaintenance($id: Int!) {
    deleteFrommaintenance_recordsCollection(filter: { id: { eq: $id } }) {
      records {
        id
      }
    }
  }
`;
