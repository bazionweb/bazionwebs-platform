import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { loadTenantHostingTemplate } from "./templates.js";

const directories: string[] = [];

async function templateRoot() {
  const root = await mkdtemp(join(tmpdir(), "bazion-hosting-templates-"));
  directories.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("loadTenantHostingTemplate", () => {
  it("loads only the selected allowlisted Compose file and hashes the exact bytes", async () => {
    const root = await templateRoot();
    const composeFile = "services:\n  app:\n    image: ${APP_IMAGE:?required}\n";
    await mkdir(join(root, "node-nextjs"), { recursive: true });
    await writeFile(join(root, "node-nextjs", "compose.yaml"), composeFile);

    const result = await loadTenantHostingTemplate("node-nextjs", root);

    expect(result.composeFile).toBe(composeFile);
    expect(result.template).toBe("node-nextjs");
    expect(result.templateVersion).toBe("sha256:" + createHash("sha256").update(composeFile).digest("hex"));
  });

  it("does not fall back to a different template when the selected file is missing", async () => {
    const root = await templateRoot();
    await mkdir(join(root, "wordpress"), { recursive: true });
    await writeFile(join(root, "wordpress", "compose.yaml"), "services: {}\n");
    await expect(loadTenantHostingTemplate("ecommerce", root)).rejects.toThrow("HOSTING_TEMPLATE_UNAVAILABLE");
  });

  it("rejects an empty Compose template", async () => {
    const root = await templateRoot();
    await mkdir(join(root, "wordpress"), { recursive: true });
    await writeFile(join(root, "wordpress", "compose.yaml"), "  \n");
    await expect(loadTenantHostingTemplate("wordpress", root)).rejects.toThrow("HOSTING_TEMPLATE_UNAVAILABLE");
  });
});
