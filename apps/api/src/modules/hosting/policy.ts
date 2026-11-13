import { z } from "zod";
import { TENANT_HOSTING_TEMPLATES } from "@bazion/platform-contracts";

export const hostingProvisionInputSchema = z.object({
  template: z.enum(TENANT_HOSTING_TEMPLATES),
}).strict();

export const hostingLifecycleActionSchema = z.object({
  action: z.enum(["start", "stop", "redeploy", "remove"]),
}).strict();
