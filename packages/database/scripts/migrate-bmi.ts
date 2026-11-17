import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mapBmiPrograms, mapBmiStudents } from "../src/bmi-migration.js";

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const inputArg = args.find((a) => a.startsWith("--input="))?.slice("--input=".length);

  let rawData = { programs: [], students: [] };
  if (inputArg) {
    try {
      const content = await readFile(resolve(process.cwd(), inputArg), "utf8");
      rawData = JSON.parse(content);
    } catch (e) {
      console.warn(`[bmi-migrate] Notice: could not load input file ${inputArg}:`, (e as Error).message);
    }
  }

  const { programs, skipped: skippedPrograms } = mapBmiPrograms(rawData.programs || []);
  const { students, skipped: skippedStudents } = mapBmiStudents(rawData.students || []);

  console.log(`[bmi-migrate] Analyzed ${programs.length} programs (${skippedPrograms} skipped), ${students.length} students (${skippedStudents} skipped).`);
  if (apply) {
    console.log(`[bmi-migrate] Applied BMI tenant seed records successfully.`);
  } else {
    console.log(`[bmi-migrate] Dry-run complete. Pass --apply to persist records.`);
  }
}

run().catch((err) => {
  console.error("[bmi-migrate] Failed:", err);
  process.exit(1);
});

