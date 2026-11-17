export interface HkmMemberSource {
  id?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  membership_number?: unknown;
  phone?: unknown;
  email?: unknown;
  branch_id?: unknown;
  status?: unknown;
  role?: unknown;
  date_of_birth?: unknown;
  baptism_date?: unknown;
  address?: unknown;
}

export interface HkmTransactionSource {
  id?: unknown;
  member_id?: unknown;
  amount?: unknown;
  transaction_type?: unknown;
  transaction_date?: unknown;
  payment_method?: unknown;
  receipt_number?: unknown;
  description?: unknown;
  branch_id?: unknown;
}

export interface HkmAttendanceSource {
  id?: unknown;
  service_date?: unknown;
  service_type?: unknown;
  count_men?: unknown;
  count_women?: unknown;
  count_children?: unknown;
  branch_id?: unknown;
}

export interface HkmBranchSource {
  id?: unknown;
  name?: unknown;
  location?: unknown;
  pastor_name?: unknown;
  contact_phone?: unknown;
  contact_email?: unknown;
}

export interface MappedHkmMember {
  id: string;
  membershipNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  branchId: string | null;
  status: "active" | "inactive" | "transferred" | "archived";
  role: string;
  dateOfBirth: string | null;
  baptismDate: string | null;
  address: string | null;
}

export interface MappedHkmTransaction {
  id: string;
  memberId: string | null;
  amount: number;
  transactionType: "tithe" | "offering" | "thanksgiving" | "building_fund" | "benevolence" | "other";
  transactionDate: string;
  paymentMethod: "mpesa" | "cash" | "bank_transfer" | "card";
  receiptNumber: string;
  description: string;
  branchId: string | null;
}

export interface MappedHkmAttendance {
  id: string;
  serviceDate: string;
  serviceType: string;
  countMen: number;
  countWomen: number;
  countChildren: number;
  totalAttendance: number;
  branchId: string | null;
}

export interface MappedHkmBranch {
  id: string;
  name: string;
  location: string;
  pastorName: string;
  contactPhone: string | null;
  contactEmail: string | null;
}

export function mapHkmMembers(sources: HkmMemberSource[]): {
  members: MappedHkmMember[];
  skipped: number;
} {
  let skipped = 0;
  const members: MappedHkmMember[] = [];

  for (const item of sources) {
    const firstName = typeof item.first_name === "string" ? item.first_name.trim() : "";
    const lastName = typeof item.last_name === "string" ? item.last_name.trim() : "";
    const membershipNumber =
      typeof item.membership_number === "string" ? item.membership_number.trim() : "";
    const id =
      typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : membershipNumber
          ? `mbr_${membershipNumber.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
          : "";

    if (!id || (!firstName && !lastName)) {
      skipped++;
      continue;
    }

    const rawStatus = typeof item.status === "string" ? item.status.toLowerCase() : "active";
    const status: MappedHkmMember["status"] =
      rawStatus.includes("inact") ? "inactive"
      : rawStatus.includes("trans") ? "transferred"
      : rawStatus.includes("arch") ? "archived"
      : "active";

    members.push({
      id,
      membershipNumber: membershipNumber || `HKM-${id.slice(0, 6).toUpperCase()}`,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      email: typeof item.email === "string" && item.email.includes("@") ? item.email.trim().toLowerCase() : null,
      phone: typeof item.phone === "string" && item.phone.trim() ? item.phone.trim() : null,
      branchId: typeof item.branch_id === "string" ? item.branch_id.trim() : null,
      status,
      role: typeof item.role === "string" && item.role.trim() ? item.role.trim() : "Member",
      dateOfBirth: typeof item.date_of_birth === "string" ? item.date_of_birth.trim() : null,
      baptismDate: typeof item.baptism_date === "string" ? item.baptism_date.trim() : null,
      address: typeof item.address === "string" ? item.address.trim() : null,
    });
  }

  return { members, skipped };
}

export function mapHkmTransactions(sources: HkmTransactionSource[]): {
  transactions: MappedHkmTransaction[];
  skipped: number;
} {
  let skipped = 0;
  const transactions: MappedHkmTransaction[] = [];

  for (const item of sources) {
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const rawAmount = typeof item.amount === "number" ? item.amount : Number(item.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      skipped++;
      continue;
    }

    const rawType = typeof item.transaction_type === "string" ? item.transaction_type.toLowerCase() : "tithe";
    const transactionType: MappedHkmTransaction["transactionType"] =
      rawType.includes("offer") ? "offering"
      : rawType.includes("thank") ? "thanksgiving"
      : rawType.includes("build") ? "building_fund"
      : rawType.includes("benev") ? "benevolence"
      : rawType.includes("tithe") ? "tithe"
      : "other";

    const rawMethod = typeof item.payment_method === "string" ? item.payment_method.toLowerCase() : "mpesa";
    const paymentMethod: MappedHkmTransaction["paymentMethod"] =
      rawMethod.includes("cash") ? "cash"
      : rawMethod.includes("bank") ? "bank_transfer"
      : rawMethod.includes("card") ? "card"
      : "mpesa";

    transactions.push({
      id,
      memberId: typeof item.member_id === "string" ? item.member_id.trim() : null,
      amount: Math.round(rawAmount * 100) / 100,
      transactionType,
      transactionDate: typeof item.transaction_date === "string" ? item.transaction_date.trim() : new Date().toISOString(),
      paymentMethod,
      receiptNumber: typeof item.receipt_number === "string" ? item.receipt_number.trim() : `REC-${id.slice(0, 8).toUpperCase()}`,
      description: typeof item.description === "string" ? item.description.trim() : `${transactionType.toUpperCase()} contribution`,
      branchId: typeof item.branch_id === "string" ? item.branch_id.trim() : null,
    });
  }

  return { transactions, skipped };
}

export function mapHkmAttendance(sources: HkmAttendanceSource[]): {
  records: MappedHkmAttendance[];
  skipped: number;
} {
  let skipped = 0;
  const records: MappedHkmAttendance[] = [];

  for (const item of sources) {
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const men = typeof item.count_men === "number" ? Math.max(0, item.count_men) : 0;
    const women = typeof item.count_women === "number" ? Math.max(0, item.count_women) : 0;
    const children = typeof item.count_children === "number" ? Math.max(0, item.count_children) : 0;
    const total = men + women + children;

    records.push({
      id,
      serviceDate: typeof item.service_date === "string" ? item.service_date.trim() : new Date().toISOString().split("T")[0]!,
      serviceType: typeof item.service_type === "string" ? item.service_type.trim() : "Sunday Main Service",
      countMen: men,
      countWomen: women,
      countChildren: children,
      totalAttendance: total,
      branchId: typeof item.branch_id === "string" ? item.branch_id.trim() : null,
    });
  }

  return { records, skipped };
}

export function mapHkmBranches(sources: HkmBranchSource[]): {
  branches: MappedHkmBranch[];
  skipped: number;
} {
  let skipped = 0;
  const branches: MappedHkmBranch[] = [];

  for (const item of sources) {
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const id =
      typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : name
          ? `br_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
          : "";

    if (!id || !name) {
      skipped++;
      continue;
    }

    branches.push({
      id,
      name,
      location: typeof item.location === "string" ? item.location.trim() : "Main Campus",
      pastorName: typeof item.pastor_name === "string" ? item.pastor_name.trim() : "Resident Pastor",
      contactPhone: typeof item.contact_phone === "string" ? item.contact_phone.trim() : null,
      contactEmail: typeof item.contact_email === "string" ? item.contact_email.trim() : null,
    });
  }

  return { branches, skipped };
}

