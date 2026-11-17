/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type DocumentNode = { loc?: any; definitions?: any[] };

export function gql(strings: TemplateStringsArray, ..._values: any[]): DocumentNode {
  const queryStr = strings.join("");
  return { loc: { source: { body: queryStr } } };
}

// In-Memory Data Store for Church Management
const defaultMembers = [
  {
    id: "HKM-001",
    first_name: "Senior Pastor",
    last_name: "John Doe",
    title: "Senior Pastor",
    email: "pastor@hkm.org",
    phone: "+254700000001",
    department: "Pastoral",
    status: "Active",
    dob: "1980-05-14",
    gender: "Male",
    address: "Nairobi Central Campus",
    joined_at: "2020-01-01",
    occupation: "Senior Clergy",
    marital_status: "Married",
    pin: "1234",
    is_portal_active: true,
    email_tier: "pastoral",
    org_email: "pastor@hkm.org",
  },
  {
    id: "HKM-002",
    first_name: "Deaconess",
    last_name: "Jane Smith",
    title: "Deaconess",
    email: "jane.smith@gmail.com",
    phone: "+254700000002",
    department: "Choir & Worship",
    status: "Active",
    dob: "1988-11-20",
    gender: "Female",
    address: "Westlands Assembly",
    joined_at: "2021-03-15",
    occupation: "Accountant",
    marital_status: "Married",
    pin: "4321",
    is_portal_active: true,
    email_tier: "member",
    org_email: "jane.smith@hkm.org",
  },
  {
    id: "HKM-003",
    first_name: "Brother",
    last_name: "David Kimani",
    title: "Brother",
    email: "david.kimani@outlook.com",
    phone: "+254722334455",
    department: "Media & Sound",
    status: "Active",
    dob: "1995-02-10",
    gender: "Male",
    address: "Thika Road Campus",
    joined_at: "2022-06-10",
    occupation: "Software Engineer",
    marital_status: "Single",
    pin: "5678",
    is_portal_active: true,
    email_tier: "member",
    org_email: "david.kimani@hkm.org",
  },
];

const defaultTransactions = [
  {
    id: 101,
    date: new Date().toISOString().split("T")[0],
    category: "Tithe",
    type: "Income",
    amount: 15000,
    description: "Senior Pastor Tithe",
    member_id: "HKM-001",
  },
  {
    id: 102,
    date: new Date().toISOString().split("T")[0],
    category: "Building Fund",
    type: "Income",
    amount: 5000,
    description: "Church Expansion Offering",
    member_id: "HKM-002",
  },
  {
    id: 103,
    date: new Date().toISOString().split("T")[0],
    category: "Thanksgiving",
    type: "Income",
    amount: 8000,
    description: "Annual Thanksgiving Harvest",
    member_id: "HKM-003",
  },
];

const defaultAttendance = [
  {
    id: 201,
    date: new Date().toISOString().split("T")[0],
    service: "Sunday Celebration Service",
    member_id: "HKM-001",
    status: "Present",
    members: { first_name: "Senior Pastor", last_name: "John Doe" },
  },
  {
    id: 202,
    date: new Date().toISOString().split("T")[0],
    service: "Sunday Celebration Service",
    member_id: "HKM-002",
    status: "Present",
    members: { first_name: "Deaconess", last_name: "Jane Smith" },
  },
];

const defaultBranches = [
  {
    id: 1,
    name: "HKM Main Sanctuary (Nairobi)",
    location: "Nairobi Central",
    manager_id: "USR-001",
    phone: "+254 700 000 001",
    email: "info@hkmministries.org",
    is_active: true,
  },
  {
    id: 2,
    name: "HKM Thika Assembly",
    location: "Thika Town",
    manager_id: "USR-001",
    phone: "+254 700 000 002",
    email: "thika@hkmministries.org",
    is_active: true,
  },
];

const defaultGroups = [
  {
    id: 1,
    name: "Pastoral & Elders Council",
    leader_id: "HKM-001",
    member_count: 8,
    category: "Leadership",
  },
  {
    id: 2,
    name: "Heavenly Praise Choir",
    leader_id: "HKM-002",
    member_count: 24,
    category: "Worship & Arts",
  },
  {
    id: 3,
    name: "Youth & Young Adults Fellowship",
    leader_id: "HKM-003",
    member_count: 45,
    category: "Youth",
  },
];

const defaultEquipment = [
  {
    id: 1,
    name: "Yamaha Digital Mixing Console CL5",
    category: "Audio & PA",
    purchase_date: "2023-01-15",
    purchase_price: 650000,
    condition: "Good",
    location: "Main Sanctuary",
    description: "64-channel professional audio mixing console.",
    maintenance_recordsCollection: { edges: [] },
  },
  {
    id: 2,
    name: "Sony 4K Live Broadcast PTZ Camera",
    category: "Media & Streaming",
    purchase_date: "2023-04-20",
    purchase_price: 320000,
    condition: "Excellent",
    location: "Gallery Balcony",
    description: "Broadcast robotic camera with NDI support.",
    maintenance_recordsCollection: { edges: [] },
  },
];

const defaultVisitors = [
  {
    id: 1,
    name: "Mary Wambui",
    phone: "+254711223344",
    email: "mary.wambui@yahoo.com",
    heard_from: "Social Media",
    status: "New",
    first_visit: new Date().toISOString().split("T")[0],
    registered_date: new Date().toISOString().split("T")[0],
  },
];

const defaultUsers = [
  {
    id: "USR-001",
    username: "admin",
    email: "admin@hkm.org",
    role: "Super Admin",
    avatar: "https://ui-avatars.com/api/?name=Admin+User",
    last_login: new Date().toISOString(),
  },
];

class StoreState {
  members = [...defaultMembers];
  transactions = [...defaultTransactions];
  attendance = [...defaultAttendance];
  branches = [...defaultBranches];
  groups = [...defaultGroups];
  equipment = [...defaultEquipment];
  visitors = [...defaultVisitors];
  users = [...defaultUsers];
  smsRecords: any[] = [];
  recycleBin: any[] = [];
  permissionRequests: any[] = [];
  messages: any[] = [];
  listeners = new Set<() => void>();

  notify() {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const globalStore = new StoreState();

export class InMemoryCache {
  constructor(_config?: any) {}
}

export function createHttpLink(options: { uri: string }) {
  return { uri: options.uri };
}

export function setContext(fn: any) {
  return {
    concat: (link: any) => ({ ...link, contextFn: fn }),
  };
}

export class ApolloClient {
  constructor(_options: any) {}

  async query(options: { query: DocumentNode; variables?: any; fetchPolicy?: string }): Promise<any> {
    const queryStr = options.query?.loc?.source?.body || "";
    const vars = options.variables || {};

    if (queryStr.includes("membersCollection")) {
      let filtered = globalStore.members;
      if (vars.memberId) {
        filtered = filtered.filter((m) => m.id === vars.memberId);
      }
      return {
        data: {
          membersCollection: {
            pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null },
            edges: filtered.map((node) => ({ node, cursor: node.id })),
          },
          transactionsCollection: {
            edges: globalStore.transactions
              .filter((t) => !vars.memberId || t.member_id === vars.memberId)
              .map((node) => ({ node })),
          },
          attendance_recordsCollection: {
            edges: globalStore.attendance
              .filter((a) => !vars.memberId || a.member_id === vars.memberId)
              .map((node) => ({ node })),
          },
        },
      };
    }

    if (queryStr.includes("transactionsCollection")) {
      return {
        data: {
          transactionsCollection: {
            pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null },
            edges: globalStore.transactions.map((node) => ({ node, cursor: String(node.id) })),
          },
        },
      };
    }

    if (queryStr.includes("attendance_recordsCollection")) {
      return {
        data: {
          attendance_recordsCollection: {
            pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null },
            edges: globalStore.attendance.map((node) => ({ node, cursor: String(node.id) })),
          },
        },
      };
    }

    if (queryStr.includes("branchesCollection")) {
      return {
        data: {
          branchesCollection: {
            edges: globalStore.branches.map((node) => ({ node })),
          },
        },
      };
    }

    if (queryStr.includes("groupsCollection")) {
      return {
        data: {
          groupsCollection: {
            edges: globalStore.groups.map((node) => ({ node })),
          },
        },
      };
    }

    if (queryStr.includes("equipmentCollection")) {
      return {
        data: {
          equipmentCollection: {
            edges: globalStore.equipment.map((node) => ({ node })),
          },
        },
      };
    }

    if (queryStr.includes("visitorsCollection")) {
      return {
        data: {
          visitorsCollection: {
            edges: globalStore.visitors.map((node) => ({ node })),
          },
        },
      };
    }

    if (queryStr.includes("usersCollection")) {
      return {
        data: {
          usersCollection: {
            edges: globalStore.users.map((node) => ({ node })),
          },
        },
      };
    }

    if (queryStr.includes("church_settingsCollection")) {
      return {
        data: {
          church_settingsCollection: {
            edges: [
              {
                node: {
                  id: 1,
                  name: "Heavenly God Kingdom Churches (HKM Ministries)",
                  address: "Nairobi Central & Multi-Branch Regional Campuses",
                  phone: "+254 700 000 001",
                  email: "info@hkmministries.org",
                  website: "https://hkmministries.org",
                  logo_url: "/hkm-logo.webp",
                },
              },
            ],
          },
        },
      };
    }

    return { data: {} };
  }

  async mutate(options: { mutation: DocumentNode; variables?: any }): Promise<any> {
    const mutationStr = options.mutation?.loc?.source?.body || "";
    const vars = options.variables || {};

    if (mutationStr.includes("insertIntomembersCollection")) {
      const obj = vars.object || {};
      const newMember = { ...obj, id: obj.id || `HKM-${Date.now()}` };
      globalStore.members = [newMember, ...globalStore.members];
      globalStore.notify();
      return { data: { insertIntomembersCollection: { records: [newMember] } } };
    }

    if (mutationStr.includes("updatemembersCollection")) {
      const id = vars.id;
      const updates = vars.updates || vars.set || {};
      globalStore.members = globalStore.members.map((m) => (m.id === id ? { ...m, ...updates } : m));
      globalStore.notify();
      return { data: { updatemembersCollection: { records: [{ id, ...updates }] } } };
    }

    if (mutationStr.includes("deleteFrommembersCollection")) {
      const id = vars.id;
      globalStore.members = globalStore.members.filter((m) => m.id !== id);
      globalStore.notify();
      return { data: { deleteFrommembersCollection: { records: [{ id }] } } };
    }

    if (mutationStr.includes("insertIntotransactionsCollection")) {
      const obj = vars.object || {};
      const newTx = { ...obj, id: Date.now() };
      globalStore.transactions = [newTx, ...globalStore.transactions];
      globalStore.notify();
      return { data: { insertIntotransactionsCollection: { records: [newTx] } } };
    }

    if (mutationStr.includes("insertIntoattendance_recordsCollection")) {
      const objs = vars.objects || [];
      const records = objs.map((o: any, idx: number) => ({ id: Date.now() + idx, ...o }));
      globalStore.attendance = [...records, ...globalStore.attendance];
      globalStore.notify();
      return { data: { insertIntoattendance_recordsCollection: { records } } };
    }

    if (mutationStr.includes("insertIntobranchesCollection")) {
      const obj = vars.object || {};
      const newB = { ...obj, id: Date.now() };
      globalStore.branches = [newB, ...globalStore.branches];
      globalStore.notify();
      return { data: { insertIntobranchesCollection: { records: [newB] } } };
    }

    if (mutationStr.includes("insertIntomessagesCollection")) {
      const objs = vars.objects || [vars.object] || [];
      return { data: { insertIntomessagesCollection: { records: objs } } };
    }

    return { data: {} };
  }

  async resetStore() {}
}

export function ApolloProvider({ client: _c, children }: { client: any; children: React.ReactNode }) {
  return <>{children}</>;
}

export function useQuery(query: DocumentNode, options?: { variables?: any; fetchPolicy?: string; [key: string]: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const execute = async () => {
    try {
      const client = new ApolloClient({});
      const res = await client.query({ query, variables: options?.variables });
      setData(res.data);
      setLoading(false);
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    execute();
    return globalStore.subscribe(() => {
      execute();
    });
  }, [query, JSON.stringify(options?.variables)]);

  return {
    data,
    loading,
    error,
    refetch: execute,
    fetchMore: async (_moreOptions?: any) => {},
  };
}

export function useMutation(mutation: DocumentNode, _options?: { variables?: any; refetchQueries?: any; [key: string]: any }) {
  const [loading, setLoading] = useState(false);

  const mutate = async (callOptions?: { variables?: any; refetchQueries?: any; [key: string]: any }) => {
    setLoading(true);
    try {
      const client = new ApolloClient({});
      const res = await client.mutate({ mutation, variables: callOptions?.variables });
      setLoading(false);
      return res;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  return [mutate, { loading }] as const;
}

export function useApolloClient() {
  return new ApolloClient({});
}

export function useSubscription(query: DocumentNode, options?: { variables?: any }) {
  return useQuery(query, options);
}

export default ApolloClient;
