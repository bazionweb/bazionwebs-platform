import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { TenantHostingTemplate } from "@bazion/platform-contracts";

export interface LoadedTenantHostingTemplate {
  template: TenantHostingTemplate;
  composeFile: string;
  templateVersion: string;
}

const templateFiles: Record<TenantHostingTemplate, string> = {
  wordpress: "wordpress/compose.yaml",
  "node-nextjs": "node-nextjs/compose.yaml",
  ecommerce: "ecommerce/compose.yaml",
};

/** Loads only the checked-in template selected by the typed allowlist. */
export async function loadTenantHostingTemplate(
  template: TenantHostingTemplate,
  templateDirectory: string,
): Promise<LoadedTenantHostingTemplate> {
  const root = resolve(templateDirectory);
  const file = resolve(root, templateFiles[template]);
  const pathFromRoot = relative(root, file);
  if (!pathFromRoot || pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === ".." || isAbsolute(pathFromRoot)) {
    throw new Error("HOSTING_TEMPLATE_PATH_INVALID");
  }

  try {
    const info = await stat(file);
    if (!info.isFile() || info.size < 1 || info.size > 256 * 1024) {
      throw new Error("HOSTING_TEMPLATE_FILE_INVALID");
    }
    const composeFile = await readFile(file, "utf8");
    if (!composeFile.trim()) throw new Error("HOSTING_TEMPLATE_FILE_INVALID");
    const digest = createHash("sha256").update(composeFile, "utf8").digest("hex");
    return { template, composeFile, templateVersion: `sha256:${digest}` };
  } catch {
    throw new Error("HOSTING_TEMPLATE_UNAVAILABLE");
  }
}
