import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

function isWithin(directory, path) {
  const pathFromDirectory = relative(directory, path);
  return pathFromDirectory === "" || (!isAbsolute(pathFromDirectory) && pathFromDirectory !== ".." && !pathFromDirectory.startsWith(`..${sep}`));
}

function sourceCandidates(packageRoot, targetPath) {
  let config;
  try {
    config = JSON.parse(readFileSync(resolve(packageRoot, "tsconfig.json"), "utf8"));
  } catch {
    return [];
  }

  const { rootDir, outDir } = config.compilerOptions ?? {};
  if (typeof rootDir !== "string" || typeof outDir !== "string") return [];

  const sourceRoot = resolve(packageRoot, rootDir);
  const outputRoot = resolve(packageRoot, outDir);
  if (!isWithin(packageRoot, sourceRoot) || !isWithin(packageRoot, outputRoot) || !isWithin(outputRoot, targetPath)) return [];

  const outputRelative = relative(outputRoot, targetPath);
  const sourceBase = resolve(sourceRoot, outputRelative.replace(/\.(?:d\.(?:ts|mts|cts)|[cm]?js)$/, ""));
  if (!isWithin(sourceRoot, sourceBase)) return [];
  return [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]
    .map((extension) => `${sourceBase}${extension}`);
}

/**
 * Package exports can point at generated build files, which are intentionally
 * absent from a clean checkout. Accept such targets only when the package's
 * TypeScript build configuration maps them to an existing source file.
 */
export function packageExportTargetResolves(packageRootPath, target) {
  if (typeof target !== "string" || !target.startsWith("./")) return false;

  const packageRoot = resolve(packageRootPath);
  const targetPath = resolve(packageRoot, target);
  if (!isWithin(packageRoot, targetPath)) return false;
  if (existsSync(targetPath)) return true;

  return sourceCandidates(packageRoot, targetPath).some((sourcePath) => existsSync(sourcePath));
}
