import { describe, expect, it, vi } from "vitest";
import { formatFilenameStem, isAllowedImageFile, traverseDataTransferItems } from "./folder-traversal.js";
import { BoundedUploadQueue } from "./upload-queue.js";

describe("folder-traversal and batch uploader infrastructure", () => {
  it("formats filename stems into readable titles and alt text", () => {
    expect(formatFilenameStem("2026-11-15_sunday_service_choir_04.jpg")).toBe("Sunday Service Choir 04");
    expect(formatFilenameStem("pastor_anthony_ordination_ceremony.png")).toBe("Pastor Anthony Ordination Ceremony");
    expect(formatFilenameStem("youth-camp-2026-worship.webp")).toBe("Youth Camp 2026 Worship");
    expect(formatFilenameStem("2026_08_20_sanctuary-renovation.avif")).toBe("Sanctuary Renovation");
  });

  it("identifies supported image files by mime type or extension", () => {
    const validFile1 = new File(["test"], "photo.jpg", { type: "image/jpeg" });
    const validFile2 = new File(["test"], "graphic.png", { type: "image/png" });
    const validFile3 = new File(["test"], "banner.webp", { type: "" });
    const invalidFile = new File(["test"], "document.pdf", { type: "application/pdf" });

    expect(isAllowedImageFile(validFile1)).toBe(true);
    expect(isAllowedImageFile(validFile2)).toBe(true);
    expect(isAllowedImageFile(validFile3)).toBe(true);
    expect(isAllowedImageFile(invalidFile)).toBe(false);
  });

  it("traverses an array of files, filtering unsupported formats", async () => {
    const files = [
      new File(["content"], "hero.jpg", { type: "image/jpeg" }),
      new File(["content"], "notes.txt", { type: "text/plain" }),
      new File(["content"], "choir.webp", { type: "image/webp" }),
    ];

    const discovered = await traverseDataTransferItems(files);
    expect(discovered).toHaveLength(2);
    expect(discovered.map((d) => d.file.name)).toEqual(["hero.jpg", "choir.webp"]);
  });

  it("orchestrates bounded concurrency uploads and notifies progress callbacks", async () => {
    const progressCalls: Array<{ completed: number; total: number; percentage: number }> = [];
    const completedItems: string[] = [];

    // Mock global fetch
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      return {
        ok: true,
        json: async () => ({
          asset: {
            key: `tenants/demo/media/${url.split("filename=")[1]}`,
            url: `https://cdn.example.com/media/${url.split("filename=")[1]}`,
            contentType: "image/jpeg",
            sizeBytes: 1024,
          },
        }),
      };
    });
    vi.stubGlobal("fetch", mockFetch);

    const queue = new BoundedUploadQueue({
      concurrency: 2,
      uploadEndpoint: "/v1/admin/church/media",
      onQueueProgress: (completed, total, percentage) => {
        progressCalls.push({ completed, total, percentage });
      },
      onItemComplete: (item) => {
        if (item.status === "success") {
          completedItems.push(item.file.name);
        }
      },
    });

    const mockFiles = [
      { file: new File(["data"], "photo1.jpg", { type: "image/jpeg" }) },
      { file: new File(["data"], "photo2.jpg", { type: "image/jpeg" }) },
      { file: new File(["data"], "photo3.jpg", { type: "image/jpeg" }) },
    ];

    queue.addFiles(mockFiles);
    expect(queue.getItems()).toHaveLength(3);

    await new Promise<void>((resolve) => {
      queue["options"].onAllComplete = (successful) => {
        expect(successful).toHaveLength(3);
        resolve();
      };
      queue.start();
    });

    expect(completedItems).toEqual(["photo1.jpg", "photo2.jpg", "photo3.jpg"]);
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1]?.percentage).toBe(100);

    vi.unstubAllGlobals();
  });
});

