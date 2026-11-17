import fs from "node:fs";
import path from "node:path";

const files = [
  { from: "src/dark-mode.css", to: "dist/dark-mode.css" },
  { from: "src/index.css", to: "dist/index.css" },
  { from: "src/portal/portal.css", to: "dist/portal/portal.css" },
  { from: "src/shims/empty.css", to: "dist/shims/empty.css" },
];

for (const { from, to } of files) {
  const fromPath = path.resolve(from);
  const toPath = path.resolve(to);
  if (fs.existsSync(fromPath)) {
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
    fs.copyFileSync(fromPath, toPath);
  }
}
console.log("Copied church-management CSS files to dist/.");
