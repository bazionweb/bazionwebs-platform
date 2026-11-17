import { describe, expect, it } from "vitest";
import {
  mapHkmMembers,
  mapHkmTransactions,
  mapHkmAttendance,
  mapHkmBranches,
} from "./hkm-migration.js";

describe("hkm-migration", () => {
  it("maps members correctly and skips empty records", () => {
    const raw = [
      {
        id: "mbr_1",
        first_name: "John",
        last_name: "Kamau",
        membership_number: "HKM-001",
        email: "john@example.com",
        phone: "+254712345678",
        status: "Active",
        role: "Deacon",
      },
      {
        id: "",
        first_name: "",
        last_name: "",
      },
    ];

    const { members, skipped } = mapHkmMembers(raw);
    expect(skipped).toBe(1);
    expect(members).toHaveLength(1);
    expect(members[0]?.fullName).toBe("John Kamau");
    expect(members[0]?.membershipNumber).toBe("HKM-001");
    expect(members[0]?.status).toBe("active");
  });

  it("maps transactions and normalizes types and methods", () => {
    const raw = [
      {
        id: "txn_1",
        member_id: "mbr_1",
        amount: 5000,
        transaction_type: "Tithe",
        payment_method: "M-Pesa",
      },
      {
        amount: -50,
      },
    ];

    const { transactions, skipped } = mapHkmTransactions(raw);
    expect(skipped).toBe(1);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.amount).toBe(5000);
    expect(transactions[0]?.transactionType).toBe("tithe");
    expect(transactions[0]?.paymentMethod).toBe("mpesa");
  });

  it("maps attendance and aggregates total counts", () => {
    const raw = [
      {
        service_date: "2026-11-15",
        service_type: "Sunday 1st Service",
        count_men: 45,
        count_women: 60,
        count_children: 35,
      },
    ];

    const { records, skipped } = mapHkmAttendance(raw);
    expect(skipped).toBe(0);
    expect(records).toHaveLength(1);
    expect(records[0]?.totalAttendance).toBe(140);
  });

  it("maps branches correctly", () => {
    const raw = [
      {
        name: "Nairobi Central",
        location: "CBD, City Square",
        pastor_name: "Pastor David",
      },
      {
        name: "",
      },
    ];

    const { branches, skipped } = mapHkmBranches(raw);
    expect(skipped).toBe(1);
    expect(branches).toHaveLength(1);
    expect(branches[0]?.name).toBe("Nairobi Central");
    expect(branches[0]?.id).toBe("br_nairobi_central");
  });
});

