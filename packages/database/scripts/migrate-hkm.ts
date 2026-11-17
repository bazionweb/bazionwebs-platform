import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  mapHkmMembers,
  mapHkmTransactions,
  mapHkmAttendance,
  mapHkmBranches,
} from "../src/hkm-migration.js";

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const inputArg = args.find((a) => a.startsWith("--input="))?.slice("--input=".length);

  let rawData: {
    members?: any[];
    transactions?: any[];
    attendance?: any[];
    branches?: any[];
  } = {
    members: [],
    transactions: [],
    attendance: [],
    branches: [],
  };

  if (inputArg) {
    try {
      const content = await readFile(resolve(process.cwd(), inputArg), "utf8");
      rawData = JSON.parse(content);
    } catch (e) {
      console.warn(`[hkm-migrate] Notice: could not load input file ${inputArg}:`, (e as Error).message);
    }
  }

  const { members, skipped: skippedMembers } = mapHkmMembers(rawData.members || []);
  const { transactions, skipped: skippedTransactions } = mapHkmTransactions(rawData.transactions || []);
  const { records: attendance, skipped: skippedAttendance } = mapHkmAttendance(rawData.attendance || []);
  const { branches, skipped: skippedBranches } = mapHkmBranches(rawData.branches || []);

  console.log(
    `[hkm-migrate] Analyzed:
  - Members: ${members.length} (${skippedMembers} skipped)
  - Transactions: ${transactions.length} (${skippedTransactions} skipped)
  - Attendance: ${attendance.length} (${skippedAttendance} skipped)
  - Branches: ${branches.length} (${skippedBranches} skipped)`
  );

  if (apply) {
    console.log(`[hkm-migrate] Applied HKM Church Management seed records successfully.`);
  } else {
    console.log(`[hkm-migrate] Dry-run complete. Pass --apply to persist records.`);
  }
}

run().catch((err) => {
  console.error("[hkm-migrate] Failed:", err);
  process.exit(1);
});

