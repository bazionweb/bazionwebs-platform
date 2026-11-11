import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getProvisionProductRequestV1JsonSchema } from "../dist/provisioning.js";

const outputPath = fileURLToPath(new URL("../contracts/provision-product-request-v1.schema.json", import.meta.url));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(getProvisionProductRequestV1JsonSchema(), null, 2)}\n`, "utf8");
process.stdout.write(`Generated ${outputPath}\n`);
