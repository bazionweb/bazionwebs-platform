export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

export interface DiscoveredFile {
  file: File;
  relativePath: string;
}

/**
 * Cleans a filename stem into human-readable text for alt text and captions.
 * Example: "2026-11-15_sunday_service_choir_04.jpg" -> "Sunday Service Choir 04"
 */
export function formatFilenameStem(filename: string): string {
  const stem = filename.replace(/\.[a-zA-Z0-9]+$/, "");
  return stem
    .replace(/^\d{4}[-_]\d{2}[-_]\d{2}[-_]?/, "") // remove ISO date prefix
    .replace(/[-_]+/g, " ") // replace dashes and underscores with spaces
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()); // title case
}

/**
 * Recursively traverses entries from an HTML5 DataTransferItemList (drag-and-drop)
 * or a FileList (file input).
 * Supports nested directories and individual file drops.
 */
export async function traverseDataTransferItems(
  items: DataTransferItemList | FileList | File[],
  allowedTypes: Set<string> = ALLOWED_IMAGE_TYPES,
): Promise<DiscoveredFile[]> {
  const results: DiscoveredFile[] = [];

  // Direct FileList or File[]
  const isFileList = typeof FileList !== "undefined" && items instanceof FileList;
  if (isFileList || Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const file = items[i]!;
      if (isAllowedImageFile(file, allowedTypes)) {
        results.push({
          file,
          relativePath: (file as { webkitRelativePath?: string }).webkitRelativePath || file.name,
        });
      }
    }
    return results;
  }

  // DataTransferItemList (drag and drop with folder support)
  const queue: Array<{ entry: FileSystemEntry; path: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const entry =
      item && typeof item === "object" && "webkitGetAsEntry" in item && typeof (item as { webkitGetAsEntry: unknown }).webkitGetAsEntry === "function"
        ? (item as { webkitGetAsEntry: () => FileSystemEntry | null }).webkitGetAsEntry()
        : null;
    if (entry) {
      queue.push({ entry, path: entry.name });
    } else if (item && typeof item === "object" && "getAsFile" in item && typeof (item as { getAsFile: unknown }).getAsFile === "function") {
      const file = (item as DataTransferItem).getAsFile();
      if (file && isAllowedImageFile(file, allowedTypes)) {
        results.push({ file, relativePath: file.name });
      }
    }
  }

  while (queue.length > 0) {
    const { entry, path } = queue.shift()!;
    if (entry.isFile) {
      const file = await readFileEntry(entry as FileSystemFileEntry);
      if (file && isAllowedImageFile(file, allowedTypes)) {
        results.push({ file, relativePath: path });
      }
    } else if (entry.isDirectory) {
      const entries = await readDirectoryEntries(entry as FileSystemDirectoryEntry);
      for (const child of entries) {
        queue.push({ entry: child, path: `${path}/${child.name}` });
      }
    }
  }

  return results;
}

export function isAllowedImageFile(file: File, allowedTypes: Set<string> = ALLOWED_IMAGE_TYPES): boolean {
  if (allowedTypes.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? ["jpg", "jpeg", "png", "webp", "avif", "gif"].includes(ext) : false;
}

function readFileEntry(fileEntry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    fileEntry.file(
      (file) => resolve(file),
      () => resolve(null),
    );
  });
}

function readDirectoryEntries(dirEntry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const reader = dirEntry.createReader();
    const allEntries: FileSystemEntry[] = [];

    function readBatch() {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...entries);
            readBatch();
          }
        },
        () => resolve(allEntries),
      );
    }

    readBatch();
  });
}
