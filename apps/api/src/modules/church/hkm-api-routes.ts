import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { defaultHkmTenantConfig } from "@bazion/church-management/config";

export interface HkmMember {
  id: string;
  membershipNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  branchId: string;
  status: "Active" | "Inactive" | "Transferred";
  role: string;
  dateOfBirth?: string;
  baptismDate?: string;
  hasPassword?: boolean;
  hashedPin?: string;
  password?: string;
}

export interface HkmTransaction {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  transactionType: "Tithe" | "Offering" | "Thanksgiving" | "Building Fund" | "Benevolence";
  transactionDate: string;
  paymentMethod: "M-Pesa" | "Cash" | "Bank Transfer";
  receiptNumber: string;
  branchId: string;
}

export interface HkmAttendanceRecord {
  id: string;
  serviceDate: string;
  serviceType: string;
  countMen: number;
  countWomen: number;
  countChildren: number;
  totalAttendance: number;
  branchId: string;
}

// In-memory persistent stores for HKM
const membersStore: HkmMember[] = [
  {
    id: "mbr-001",
    membershipNumber: "HKM-001",
    firstName: "David",
    lastName: "Kimani",
    phone: "+254712345678",
    email: "david.kimani@hkm.org",
    branchId: "br-nairobi",
    status: "Active",
    role: "Senior Elder",
    dateOfBirth: "1980-04-12",
    baptismDate: "2000-08-20",
    hasPassword: true,
    password: "Password123!",
  },
  {
    id: "mbr-002",
    membershipNumber: "HKM-002",
    firstName: "Grace",
    lastName: "Wanjiru",
    phone: "+254722334455",
    email: "grace.wanjiru@hkm.org",
    branchId: "br-nairobi",
    status: "Active",
    role: "Worship Leader",
    dateOfBirth: "1992-09-18",
    baptismDate: "2010-12-14",
    hasPassword: false,
    hashedPin: "1234",
  },
  {
    id: "mbr-003",
    membershipNumber: "HKM-003",
    firstName: "Samuel",
    lastName: "Ochieng",
    phone: "+254733445566",
    email: "samuel.ochieng@hkm.org",
    branchId: "br-nakuru",
    status: "Active",
    role: "Youth Pastor",
    dateOfBirth: "1988-02-28",
    baptismDate: "2005-04-10",
    hasPassword: true,
    password: "Password123!",
  },
];

const transactionsStore: HkmTransaction[] = [
  {
    id: "txn-001",
    memberId: "mbr-001",
    memberName: "David Kimani",
    amount: 15000,
    transactionType: "Tithe",
    transactionDate: "2026-11-01T10:00:00Z",
    paymentMethod: "M-Pesa",
    receiptNumber: "MP261101001",
    branchId: "br-nairobi",
  },
  {
    id: "txn-002",
    memberId: "mbr-002",
    memberName: "Grace Wanjiru",
    amount: 5000,
    transactionType: "Tithe",
    transactionDate: "2026-11-08T10:30:00Z",
    paymentMethod: "M-Pesa",
    receiptNumber: "MP261108002",
    branchId: "br-nairobi",
  },
  {
    id: "txn-003",
    memberId: "mbr-001",
    memberName: "David Kimani",
    amount: 10000,
    transactionType: "Building Fund",
    transactionDate: "2026-11-15T11:00:00Z",
    paymentMethod: "Bank Transfer",
    receiptNumber: "BT261115003",
    branchId: "br-nairobi",
  },
];

const attendanceStore: HkmAttendanceRecord[] = [
  {
    id: "att-001",
    serviceDate: "2026-11-01",
    serviceType: "Sunday 1st Service",
    countMen: 120,
    countWomen: 180,
    countChildren: 90,
    totalAttendance: 390,
    branchId: "br-nairobi",
  },
  {
    id: "att-002",
    serviceDate: "2026-11-08",
    serviceType: "Sunday 1st Service",
    countMen: 135,
    countWomen: 195,
    countChildren: 100,
    totalAttendance: 430,
    branchId: "br-nairobi",
  },
  {
    id: "att-003",
    serviceDate: "2026-11-15",
    serviceType: "Sunday 1st Service",
    countMen: 140,
    countWomen: 210,
    countChildren: 110,
    totalAttendance: 460,
    branchId: "br-nairobi",
  },
];

const branchesStore = [
  {
    id: "br-nairobi",
    name: "Nairobi Central Cathedral",
    location: "CBD, City Square, Nairobi",
    pastorName: "Senior Pastor",
    contactPhone: "+254 700 112233",
    contactEmail: "nairobi@hkmministries.org",
  },
  {
    id: "br-nakuru",
    name: "Nakuru Kingdom Chapel",
    location: "Kenyatta Avenue, Nakuru",
    pastorName: "Pastor Samuel Ochieng",
    contactPhone: "+254 700 223344",
    contactEmail: "nakuru@hkmministries.org",
  },
  {
    id: "br-mombasa",
    name: "Mombasa Coastal Fellowship",
    location: "Nyali Links Road, Mombasa",
    pastorName: "Pastor James Mwangi",
    contactPhone: "+254 700 334455",
    contactEmail: "mombasa@hkmministries.org",
  },
];

const equipmentStore = [
  {
    id: "eq-001",
    name: "Yamaha Digital Sound Console TF5",
    category: "Audio",
    branchId: "br-nairobi",
    status: "Good",
    serialNumber: "YM-TF5-88129",
  },
  {
    id: "eq-002",
    name: "Sony FX3 Cinema Live Camera",
    category: "Media",
    branchId: "br-nairobi",
    status: "Good",
    serialNumber: "SN-FX3-99410",
  },
];

export async function hkmApiRoutes(app: FastifyInstance) {
  // ── TENANT CONFIG & BRANDING ────────────────────────────────────────────────
  app.get("/api/church/hkm/config", async (_req, reply) => {
    return reply.send({
      success: true,
      tenantId: "00000000-0000-4000-8000-000000000077",
      config: defaultHkmTenantConfig,
    });
  });

  // ── PORTAL AUTHENTICATION & ACCESS ──────────────────────────────────────────
  app.post("/api/church/hkm/portal/check-member", async (req: FastifyRequest<{ Body: { membershipNumber?: string } }>, reply) => {
    const memNo = req.body?.membershipNumber?.trim().toUpperCase();
    if (!memNo) {
      return reply.status(400).send({ error: "Missing membership number" });
    }

    const member = membersStore.find((m) => m.membershipNumber.toUpperCase() === memNo);
    if (!member) {
      return reply.send({ exists: false, hasPassword: false });
    }

    return reply.send({
      exists: true,
      hasPassword: Boolean(member.hasPassword),
      memberName: `${member.firstName} ${member.lastName}`,
    });
  });

  app.post("/api/church/hkm/portal/login-pin", async (req: FastifyRequest<{ Body: { membershipNumber?: string; pin?: string } }>, reply) => {
    const { membershipNumber, pin } = req.body || {};
    if (!membershipNumber || !pin) {
      return reply.status(400).send({ error: "Membership number and PIN are required." });
    }

    const member = membersStore.find((m) => m.membershipNumber.toUpperCase() === membershipNumber.trim().toUpperCase());
    if (!member) {
      return reply.status(401).send({ error: "Invalid membership number or PIN." });
    }

    const validPin = member.hashedPin || "1234";
    if (pin.trim() !== validPin) {
      return reply.status(401).send({ error: "Invalid PIN code." });
    }

    return reply.send({
      success: true,
      token: `hkm_token_${member.id}_${Date.now()}`,
      member: {
        id: member.id,
        membershipNumber: member.membershipNumber,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        hasPassword: Boolean(member.hasPassword),
      },
      needsPasswordSetup: !member.hasPassword,
    });
  });

  app.post("/api/church/hkm/portal/login-password", async (req: FastifyRequest<{ Body: { membershipNumber?: string; password?: string } }>, reply) => {
    const { membershipNumber, password } = req.body || {};
    if (!membershipNumber || !password) {
      return reply.status(400).send({ error: "Membership number and password are required." });
    }

    const member = membersStore.find((m) => m.membershipNumber.toUpperCase() === membershipNumber.trim().toUpperCase());
    if (!member) {
      return reply.status(401).send({ error: "Invalid membership number or password." });
    }

    if (!member.hasPassword || member.password !== password) {
      return reply.status(401).send({ error: "Incorrect credentials." });
    }

    return reply.send({
      success: true,
      token: `hkm_token_${member.id}_${Date.now()}`,
      member: {
        id: member.id,
        membershipNumber: member.membershipNumber,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
      },
    });
  });

  app.post("/api/church/hkm/portal/set-password", async (req: FastifyRequest<{ Body: { membershipNumber?: string; newPassword?: string } }>, reply) => {
    const { membershipNumber, newPassword } = req.body || {};
    if (!membershipNumber || !newPassword || newPassword.length < 6) {
      return reply.status(400).send({ error: "Password must be at least 6 characters." });
    }

    const member = membersStore.find((m) => m.membershipNumber.toUpperCase() === membershipNumber.trim().toUpperCase());
    if (!member) {
      return reply.status(404).send({ error: "Member not found." });
    }

    member.password = newPassword;
    member.hasPassword = true;

    return reply.send({
      success: true,
      message: "Password set successfully. You may now log in with your password.",
    });
  });

  app.post("/api/church/hkm/portal/request-pin", async (req: FastifyRequest<{ Body: { membershipNumber?: string } }>, reply) => {
    const { membershipNumber } = req.body || {};
    const member = membersStore.find((m) => m.membershipNumber.toUpperCase() === membershipNumber?.trim().toUpperCase());
    if (!member) {
      return reply.status(404).send({ error: "Membership number not found." });
    }

    const newPin = "1234";
    member.hashedPin = newPin;

    return reply.send({
      success: true,
      message: `A temporary login PIN has been sent via SMS to ${member.phone.slice(0, 4)}***${member.phone.slice(-3)}.`,
    });
  });

  // ── PORTAL MEMBER SELF-SERVICE DATA ─────────────────────────────────────────
  app.get("/api/church/hkm/portal/giving-history", async (req: FastifyRequest<{ Querystring: { memberId?: string } }>, reply) => {
    const memberId = req.query?.memberId || "mbr-001";
    const history = transactionsStore.filter((t) => t.memberId === memberId);
    const totalGiven = history.reduce((sum, t) => sum + t.amount, 0);

    return reply.send({
      success: true,
      memberId,
      totalGiven,
      currency: "KES",
      transactions: history,
    });
  });

  app.get("/api/church/hkm/portal/statement", async (req: FastifyRequest<{ Querystring: { memberId?: string; year?: string } }>, reply) => {
    const memberId = req.query?.memberId || "mbr-001";
    const year = req.query?.year || "2026";
    const member = membersStore.find((m) => m.id === memberId) || membersStore[0]!;

    const txs = transactionsStore.filter((t) => t.memberId === memberId && t.transactionDate.startsWith(year));
    const totalTithe = txs.filter((t) => t.transactionType === "Tithe").reduce((s, t) => s + t.amount, 0);
    const totalOffering = txs.filter((t) => t.transactionType === "Offering").reduce((s, t) => s + t.amount, 0);
    const totalOther = txs.filter((t) => t.transactionType !== "Tithe" && t.transactionType !== "Offering").reduce((s, t) => s + t.amount, 0);

    return reply.send({
      churchName: defaultHkmTenantConfig.churchName,
      statementYear: year,
      member: {
        name: `${member.firstName} ${member.lastName}`,
        membershipNumber: member.membershipNumber,
        email: member.email,
        phone: member.phone,
      },
      summary: {
        totalTithe,
        totalOffering,
        totalOther,
        grandTotal: totalTithe + totalOffering + totalOther,
        currency: "KES",
      },
      transactions: txs,
    });
  });

  // ── CHURCH CMS ADMIN ENDPOINTS ──────────────────────────────────────────────
  app.get("/api/church/hkm/stats", async (_req, reply) => {
    const totalGiving = transactionsStore.reduce((acc, t) => acc + t.amount, 0);
    const latestAttendance = attendanceStore[attendanceStore.length - 1]?.totalAttendance || 0;

    return reply.send({
      success: true,
      stats: {
        totalMembers: membersStore.length,
        totalGiving,
        latestAttendance,
        totalBranches: branchesStore.length,
        totalEquipment: equipmentStore.length,
      },
    });
  });

  app.get("/api/church/hkm/members", async (_req, reply) => {
    return reply.send({
      success: true,
      data: membersStore.map((m) => ({
        id: m.id,
        membership_number: m.membershipNumber,
        first_name: m.firstName,
        last_name: m.lastName,
        phone: m.phone,
        email: m.email,
        branch_id: m.branchId,
        status: m.status,
        role: m.role,
      })),
    });
  });

  app.post("/api/church/hkm/members", async (req: FastifyRequest<{ Body: Partial<HkmMember> }>, reply) => {
    const body = req.body || {};
    const newId = `mbr-${Date.now()}`;
    const newMember: HkmMember = {
      id: newId,
      membershipNumber: body.membershipNumber || `HKM-${membersStore.length + 100}`,
      firstName: body.firstName || "Member",
      lastName: body.lastName || "",
      phone: body.phone || "+254700000000",
      email: body.email || "member@hkm.org",
      branchId: body.branchId || "br-nairobi",
      status: body.status || "Active",
      role: body.role || "Member",
      hasPassword: false,
    };
    membersStore.push(newMember);

    return reply.status(201).send({
      success: true,
      member: newMember,
    });
  });

  app.get("/api/church/hkm/transactions", async (_req, reply) => {
    return reply.send({
      success: true,
      data: transactionsStore,
    });
  });

  app.post("/api/church/hkm/transactions", async (req: FastifyRequest<{ Body: Partial<HkmTransaction> }>, reply) => {
    const body = req.body || {};
    const newTxn: HkmTransaction = {
      id: `txn-${Date.now()}`,
      memberId: body.memberId || "mbr-001",
      memberName: body.memberName || "Church Member",
      amount: Number(body.amount) || 1000,
      transactionType: body.transactionType || "Tithe",
      transactionDate: body.transactionDate || new Date().toISOString(),
      paymentMethod: body.paymentMethod || "M-Pesa",
      receiptNumber: body.receiptNumber || `MP-${Date.now().toString().slice(-6)}`,
      branchId: body.branchId || "br-nairobi",
    };
    transactionsStore.push(newTxn);

    return reply.status(201).send({
      success: true,
      transaction: newTxn,
    });
  });

  app.get("/api/church/hkm/attendance", async (_req, reply) => {
    return reply.send({
      success: true,
      data: attendanceStore,
    });
  });

  app.get("/api/church/hkm/branches", async (_req, reply) => {
    return reply.send({
      success: true,
      data: branchesStore,
    });
  });

  app.get("/api/church/hkm/equipment", async (_req, reply) => {
    return reply.send({
      success: true,
      data: equipmentStore,
    });
  });
}
