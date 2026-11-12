import { z } from "zod";

export const hostingProvisionInputSchema = z.object({
  template: z.enum(["wordpress", "node-nextjs", "ecommerce"]),
}).strict();

export const hostingLifecycleActionSchema = z.object({
  action: z.enum(["start", "stop", "redeploy", "remove"]),
}).strict();
