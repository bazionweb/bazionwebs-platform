import { useCallback, useEffect, useState } from "react";
import { Branch } from "../components/branchData";
import { formatEmail, toTitleCase } from "../utils/stringFormatter";
import { hkmApiRequest } from "../services/hkmApi";

interface HkmBranchRecord {
  id: string;
  name: string;
  location?: string;
  pastorName?: string;
  contactPhone?: string;
  contactEmail?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

function toBranch(row: HkmBranchRecord): Branch {
  return {
    id: row.id,
    name: row.name,
    location: row.location ?? "",
    address: row.location ?? "",
    phone: row.contactPhone ?? "",
    email: row.contactEmail ?? "",
    isActive: row.status === "active",
    pastor: {
      name: row.pastorName ?? "",
      email: row.contactEmail ?? "",
      phone: row.contactPhone ?? "",
      gender: "Male",
      maritalStatus: "Single",
      avatar: "",
    },
    memberCount: { male: 0, female: 0, total: 0 },
    givingRecords: [],
    createdAt: row.createdAt ?? "",
    updatedAt: row.updatedAt ?? "",
  };
}

function serializeBranch(branch: Partial<Branch>) {
  const result: Record<string, unknown> = {};
  if (branch.name !== undefined) result.name = toTitleCase(branch.name);
  if (branch.location !== undefined || branch.address !== undefined) result.location = toTitleCase(branch.location ?? branch.address ?? "");
  if (branch.pastor?.name !== undefined) result.pastorName = toTitleCase(branch.pastor.name);
  if (branch.phone !== undefined || branch.pastor?.phone !== undefined) result.contactPhone = branch.phone ?? branch.pastor?.phone ?? "";
  const email = formatEmail(branch.email ?? branch.pastor?.email);
  if (email) result.contactEmail = email;
  if (branch.isActive !== undefined) result.status = branch.isActive ? "active" : "inactive";
  return result;
}

export function useBranches() {
  const [data, setData] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await hkmApiRequest<HkmBranchRecord[]>("/api/church/hkm/branches");
      setData(rows.map(toBranch));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Unable to load branches."));
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh().catch(() => undefined); }, [refresh]);

  const addBranch = useCallback(async (branch: Branch) => {
    await hkmApiRequest("/api/church/hkm/branches", { method: "POST", body: JSON.stringify(serializeBranch(branch)) });
    await refresh();
  }, [refresh]);

  const updateBranch = useCallback(async (id: string, branch: Partial<Branch>) => {
    const body = serializeBranch(branch);
    await hkmApiRequest(`/api/church/hkm/branches/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
    await refresh();
  }, [refresh]);

  const deleteBranch = useCallback(async (id: string) => {
    await hkmApiRequest(`/api/church/hkm/branches/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  return { data, loading, error, addBranch, updateBranch, deleteBranch };
}
