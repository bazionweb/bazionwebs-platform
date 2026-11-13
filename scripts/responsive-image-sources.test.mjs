import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { getResponsiveImageSources, isSafeImageSource } from "../packages/ui/src/responsive-image-sources.ts";

const mediaBase = "https://media.example.org/uploads";

test("responsive media uses cached Cloudflare widths for the configured public path", () => {
  const sources = getResponsiveImageSources(`${mediaBase}/tenant-1/sermon.jpg`, mediaBase);
  assert.equal(sources.src, "https://media.example.org/cdn-cgi/image/fit=scale-down,width=960,quality=80,format=auto/uploads/tenant-1/sermon.jpg");
  assert.match(sources.srcSet, /width=320/);
  assert.match(sources.srcSet, /width=1920/);
});

test("relative, external, and other-origin sources are not sent through a remote fetch proxy", () => {
  for (const source of ["/v1/public/church/media/logo", "https://images.example.net/portrait.jpg", "http://media.example.org/uploads/image.jpg"]) {
    assert.deepEqual(getResponsiveImageSources(source, mediaBase), { src: source });
  }
});

test("media URLs outside the configured path or with encoded path separators are not transformed", () => {
  for (const source of [
    "https://media.example.org/private/secret.jpg",
    "https://media.example.org/uploads-evil/image.jpg",
    "https://media.example.org/uploads/%2e%2e/private.jpg",
  ]) {
    assert.deepEqual(getResponsiveImageSources(source, mediaBase), { src: source });
  }
});

test("signed URLs, credentials, and fragments stay out of generated transform URLs", () => {
  for (const source of [
    "https://media.example.org/uploads/file.jpg?token=private",
    "https://user:password@media.example.org/uploads/file.jpg",
    "https://media.example.org/uploads/file.jpg#fragment",
  ]) {
    assert.deepEqual(getResponsiveImageSources(source, mediaBase), { src: source });
  }
});

test("only credential-free HTTPS URLs and non-protocol-relative site paths are accepted", () => {
  assert.equal(isSafeImageSource("/images/placeholder.jpg"), true);
  assert.equal(isSafeImageSource("https://images.example.net/portrait.jpg"), true);
  for (const source of ["//images.example.net/portrait.jpg", "javascript:alert(1)", "http://images.example.net/photo.jpg", "https://user:pass@images.example.net/photo.jpg", " /photo.jpg"]) {
    assert.equal(isSafeImageSource(source), false);
  }
});

test("already transformed URLs and arbitrary widths are not accepted", () => {
  const transformed = "https://media.example.org/cdn-cgi/image/width=640/uploads/photo.jpg";
  assert.deepEqual(getResponsiveImageSources(transformed, "https://media.example.org"), { src: transformed });
  assert.deepEqual(getResponsiveImageSources(`${mediaBase}/photo.jpg`, mediaBase, [320, 999]), { src: `${mediaBase}/photo.jpg` });
});

test("widths are deduplicated and sorted and fallback uses a requested width", () => {
  const sorted = getResponsiveImageSources(`${mediaBase}/photo.jpg`, mediaBase, [960, 320, 960]);
  assert.deepEqual(sorted.srcSet?.split(", ").map((entry) => entry.match(/ (\d+)w$/)?.[1]), ["320", "960"]);

  const fallback = getResponsiveImageSources(`${mediaBase}/photo.jpg`, mediaBase, [320, 640]);
  assert.match(fallback.src, /width=640/);
});

test("storefront and shared UI images use the centralized responsive image component", async () => {
  const root = process.cwd();
  const scan = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const paths = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? scan(entryPath) : entry.name.endsWith(".tsx") ? [entryPath] : [];
    }));
    return paths.flat();
  };
  const files = [
    ...await scan(path.join(root, "apps", "storefront", "app")),
    ...await scan(path.join(root, "packages", "ui", "src")),
  ];
  const unmanagedImages = [];
  for (const file of files) {
    if (file.endsWith(`${path.sep}responsive-image.tsx`)) continue;
    if (/<img\b/i.test(await readFile(file, "utf8"))) unmanagedImages.push(path.relative(root, file));
  }
  assert.deepEqual(unmanagedImages, []);
});

test("church typography does not reintroduce a browser-side Google Fonts request", async () => {
  const css = await readFile(path.join(process.cwd(), "packages", "ui", "src", "church.css"), "utf8");
  assert.doesNotMatch(css, /@import\s+url\([^)]*fonts\.googleapis\.com/i);
  assert.match(css, /var\(--font-plus-jakarta\)/);
});

test("Cloudflare transforms stay opt-in until the media zone is explicitly enabled", async () => {
  const component = await readFile(path.join(process.cwd(), "packages", "ui", "src", "responsive-image.tsx"), "utf8");
  const layout = await readFile(path.join(process.cwd(), "apps", "storefront", "app", "layout.tsx"), "utf8");
  assert.match(component, /imageTransformsEnabled:\s*false/);
  assert.match(layout, /MEDIA_IMAGE_TRANSFORMS_ENABLED\s*===\s*"true"/);
});
