import { useCallback, useEffect, useState } from "react";
import { Member } from "../components/memberData";
import { formatEmail, toTitleCase } from "../utils/stringFormatter";
import { hkmApiRequest, hkmStatusLabel } from "../services/hkmApi";

interface HkmMemberRecord {
  id: string;
  membershipNumber: string;
  firstName: string;
  lastName: string;
  title?: string;
  email: string;
  phone?: string;
  department?: string;
  gender?: string;
  avatar?: string | null;
  avatarTransform?: Member["avatarTransform"] | null;
  address?: string | null;
  occupation?: string | null;
  maritalStatus?: string | null;
  joinedAt?: string | null;
  status?: string;
  role?: string;
  dateOfBirth?: string | null;
  createdAt?: string;
  branchId?: string;
  branchName?: string;
}

interface HkmMemberPage {
  items: HkmMemberRecord[];
  total: number;
  page: number;
  perPage: number;
}

function toMember(row: HkmMemberRecord): Member {
  const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.email || `Member ${row.id}`;
  return {
    id: row.id,
    name,
    title: row.title ?? "",
    avatar: row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
    avatarTransform: row.avatarTransform ?? undefined,
    phone: row.phone ?? "",
    email: row.email ?? "",
    department: row.department ?? "",
    role: row.role ?? "Member",
    status: hkmStatusLabel(row.status),
    dateAdded: row.joinedAt ?? row.createdAt?.slice(0, 10) ?? "",
    dob: row.dateOfBirth ?? "",
    gender: (row.gender === "Female" ? "Female" : "Male"),
    occupation: row.occupation ?? undefined,
    maritalStatus: row.maritalStatus ?? undefined,
    location: row.address ?? undefined,
    pin: null,
    is_portal_active: false,
    email_tier: "member",
  };
}

function serializeMember(member: Partial<Member>) {
  const [firstName, ...lastNameParts] = (member.name ?? "").trim().split(/\s+/);
  const email = formatEmail(member.email);
  if (!firstName || !lastNameParts.length || !email) {
    throw new Error("Enter the member’s first name, last name, and email address.");
  }
  return {
    first_name: toTitleCase(firstName),
    last_name: toTitleCase(lastNameParts.join(" ")),
    title: toTitleCase(member.title),
    email,
    phone: member.phone ?? "",
    department: toTitleCase(member.department),
    gender: member.gender ?? "Male",
    avatar: member.avatar ?? null,
    avatarTransform: member.avatarTransform ?? null,
    address: member.location ?? null,
    occupation: member.occupation ?? null,
    maritalStatus: member.maritalStatus ?? null,
    joinedAt: member.dateAdded || new Date().toISOString().slice(0, 10),
    status: (member.status ?? "Active").toLowerCase().replaceAll(" ", "_"),
    role: member.role ?? "Member",
    dateOfBirth: member.dob || null,
  };
}

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 250;

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const allMembers: Member[] = [];
      let pageNumber = 1;
      let resultTotal = 0;
      do {
        const result = await hkmApiRequest<HkmMemberPage>(`/api/church/hkm/members?page=${pageNumber}&perPage=${pageSize}`);
        allMembers.push(...result.items.map(toMember));
        resultTotal = result.total;
        pageNumber += 1;
        if (result.items.length === 0) break;
      } while (allMembers.length < resultTotal);
      setMembers(allMembers);
      setTotalCount(resultTotal);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Unable to load members."));
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll().catch(() => undefined);
  }, [loadAll]);

  const refresh = loadAll;

  const addMember = useCallback(async (member: Partial<Member>) => {
    await hkmApiRequest("/api/church/hkm/members", { method: "POST", body: JSON.stringify(serializeMember(member)) });
    await refresh();
  }, [refresh]);

  const updateMember = useCallback(async (id: string, updates: Partial<Member>) => {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) {
      const [firstName, ...rest] = updates.name.trim().split(/\s+/);
      if (!firstName || !rest.length) throw new Error("Enter both the member’s first and last name.");
      payload.first_name = toTitleCase(firstName);
      payload.last_name = toTitleCase(rest.join(" "));
    }
    if (updates.title !== undefined) payload.title = toTitleCase(updates.title);
    if (updates.email !== undefined) payload.email = formatEmail(updates.email);
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.department !== undefined) payload.department = toTitleCase(updates.department);
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.avatar !== undefined) payload.avatar = updates.avatar || null;
    if (updates.avatarTransform !== undefined) payload.avatarTransform = updates.avatarTransform;
    if (updates.location !== undefined) payload.address = updates.location || null;
    if (updates.occupation !== undefined) payload.occupation = updates.occupation || null;
    if (updates.maritalStatus !== undefined) payload.maritalStatus = updates.maritalStatus || null;
    if (updates.status !== undefined) payload.status = updates.status.toLowerCase().replaceAll(" ", "_");
    if (updates.dob !== undefined) payload.dateOfBirth = updates.dob || null;
    if (updates.dateAdded !== undefined) payload.joinedAt = updates.dateAdded || null;
    if (updates.role !== undefined) payload.role = updates.role;
    await hkmApiRequest(`/api/church/hkm/members/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
    await refresh();
  }, [refresh]);

  const deleteMember = useCallback(async (id: string) => {
    await hkmApiRequest(`/api/church/hkm/members/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  return {
    data: members,
    setData: setMembers,
    loading,
    error,
    totalCount,
    totalCountLoading: false,
    refreshTotalCount: refresh,
    hasNextPage: false,
    fetchNextPage: async () => undefined,
    addMember,
    updateMember,
    deleteMember,
  };
}
