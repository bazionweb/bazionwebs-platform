import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getProvisionProductRequestV1JsonSchema,
  getProvisioningOperationV1JsonSchema,
  getProvisioningStatusEventV1JsonSchema,
} from "../dist/provisioning.js";
import { getProvisioningOfferCatalogV1JsonSchema } from "../dist/provisioning-catalog.js";
import {
  getSubscriptionLifecycleCommandV1JsonSchema,
  getSubscriptionLifecycleStatusEventV1JsonSchema,
} from "../dist/lifecycle.js";

const schemas = [
  {
    fileName: "provision-product-request-v1.schema.json",
    schema: getProvisionProductRequestV1JsonSchema(),
  },
  {
    fileName: "provisioning-offer-catalog-v1.schema.json",
    schema: getProvisioningOfferCatalogV1JsonSchema(),
  },
  {
    fileName: "provisioning-operation-v1.schema.json",
    schema: getProvisioningOperationV1JsonSchema(),
  },
  {
    fileName: "provisioning-status-event-v1.schema.json",
    schema: getProvisioningStatusEventV1JsonSchema(),
  },
  {
    fileName: "subscription-lifecycle-command-v1.schema.json",
    schema: getSubscriptionLifecycleCommandV1JsonSchema(),
  },
  {
    fileName: "subscription-lifecycle-status-event-v1.schema.json",
    schema: getSubscriptionLifecycleStatusEventV1JsonSchema(),
  },
];

for (const entry of schemas) {
  const outputPath = fileURLToPath(new URL(`../contracts/${entry.fileName}`, import.meta.url));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(entry.schema, null, 2)}\n`, "utf8");
  process.stdout.write(`Generated ${outputPath}\n`);
}
