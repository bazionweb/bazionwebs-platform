import { useCallback, useEffect, useState } from "react";
import { AttendanceRecord, AttendanceStatus } from "../components/attendanceData";
import { Member } from "../components/memberData";
import { hkmApiRequest } from "../services/hkmApi";

interface HkmAttendanceRecord {
  id: string;
  date: string;
  service: string;
  memberId: string;
  memberName: string;
  status: AttendanceStatus;
}

function toAttendanceRecord(record: HkmAttendanceRecord): AttendanceRecord {
  return { id: record.id, date: record.date, service: record.service, memberName: record.memberName, status: record.status };
}

export function useAttendance(members: Member[] = []) {
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await hkmApiRequest<HkmAttendanceRecord[]>("/api/church/hkm/member-attendance");
      setData(rows.map(toAttendanceRecord));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Unable to load attendance records."));
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh().catch(() => undefined); }, [refresh]);

  const batchSaveAttendance = useCallback(async (
    newAttendance: Record<string, AttendanceStatus>,
    serviceName: string,
    serviceDate: string,
  ) => {
    const records = Object.entries(newAttendance).flatMap(([key, status]) => {
      const member = members.find((candidate) => candidate.id === key || candidate.email === key ||
        candidate.name.toLowerCase().replace(/\s+/g, "_") === key);
      return member ? [{ memberId: member.id, status }] : [];
    });
    if (records.length === 0) return;
    await hkmApiRequest("/api/church/hkm/member-attendance/batch", {
      method: "POST",
      body: JSON.stringify({ serviceDate, serviceType: serviceName, records }),
    });
    await refresh();
  }, [members, refresh]);

  const deleteAttendanceRecord = useCallback(async (id: string | number) => {
    await hkmApiRequest(`/api/church/hkm/member-attendance/${encodeURIComponent(String(id))}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  return {
    data,
    loading,
    error,
    hasNextPage: false,
    fetchNextPage: async () => undefined,
    batchSaveAttendance,
    deleteAttendanceRecord,
  };
}
