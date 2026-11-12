import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getProvisioningOfferCatalogV1JsonSchema } from "../dist/provisioning-catalog.js";

const outputPath = fileURLToPath(new URL("../contracts/provisioning-offer-catalog-v1.schema.json", import.meta.url));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(getProvisioningOfferCatalogV1JsonSchema(), null, 2)}\n`, "utf8");
process.stdout.write(`Generated ${outputPath}\n`);
