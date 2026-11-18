import { useCallback, useEffect, useMemo, useState } from "react";
import { Group } from "../components/GroupsManagementPage";
import { Member } from "../components/memberData";
import { toTitleCase } from "../utils/stringFormatter";
import { hkmApiRequest } from "../services/hkmApi";

interface HkmSmallGroup {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  leaderName: string;
  memberCount: number;
  createdAt: string;
  status: string;
}

function toGroup(row: HkmSmallGroup, members: Member[]): Group {
  const leader = members.find((member) => member.name.toLowerCase() === row.leaderName.toLowerCase());
  return {
    id: row.id,
    name: row.name,
    leader: leader?.email ?? row.leaderName,
    members: row.memberCount ?? 0,
    created: row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : "",
    category: row.category as Group["category"],
    description: row.description ?? "",
  };
}

export function useGroups(members: Member[] = []) {
  const [rows, setRows] = useState<HkmSmallGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await hkmApiRequest<{ groups: HkmSmallGroup[] }>("/v1/admin/church/groups");
      setRows(result.groups);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Unable to load church groups."));
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh().catch(() => undefined); }, [refresh]);

  const addGroup = useCallback(async (group: Partial<Group>) => {
    const leader = members.find((member) => member.email === group.leader);
    const leaderName = leader?.name ?? group.leader ?? "";
    await hkmApiRequest("/v1/admin/church/groups", {
      method: "POST",
      body: JSON.stringify({
        name: toTitleCase(group.name), category: group.category ?? "General", description: group.description ?? "",
        leaderName, meetingSchedule: "Not set", publicLocationLabel: "Not set", isPublic: true, acceptingMembers: true,
      }),
    });
    await refresh();
  }, [members, refresh]);

  const updateGroup = useCallback(async (id: string | number, updates: Partial<Group>) => {
    const leader = updates.leader ? members.find((member) => member.email === updates.leader) : undefined;
    const body: Record<string, unknown> = {};
    if (updates.name !== undefined) body.name = toTitleCase(updates.name);
    if (updates.category !== undefined) body.category = updates.category;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.leader !== undefined) body.leaderName = leader?.name ?? updates.leader;
    await hkmApiRequest(`/v1/admin/church/groups/${encodeURIComponent(String(id))}`, { method: "PUT", body: JSON.stringify(body) });
    await refresh();
  }, [members, refresh]);

  const deleteGroup = useCallback(async (id: string | number) => {
    await hkmApiRequest(`/v1/admin/church/groups/${encodeURIComponent(String(id))}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  const groups = useMemo(() => rows.map((row) => toGroup(row, members)), [members, rows]);
  return { data: groups, loading, error, addGroup, updateGroup, deleteGroup, setData: () => undefined };
}
