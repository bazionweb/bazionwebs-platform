import { z } from "zod";

export const hostingProvisionInputSchema = z.object({
  template: z.enum(["wordpress", "node-nextjs", "ecommerce"]),
}).strict();
