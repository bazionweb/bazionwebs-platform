export interface QueueItem {
  id: string;
  file: File;
  relativePath: string;
  status: "queued" | "uploading" | "success" | "error";
  progress: number;
  asset?: {
    key: string;
    url: string;
    contentType: string;
    sizeBytes: number;
    width?: number | undefined;
    height?: number | undefined;
  } | undefined;
  error?: string | undefined;
  inferredAltText?: string | undefined;
  inferredCaption?: string | undefined;
}

export interface UploadQueueOptions {
  concurrency?: number | undefined;
  uploadEndpoint?: string | undefined;
  headers?: Record<string, string> | undefined;
  onItemProgress?: ((item: QueueItem) => void) | undefined;
  onItemComplete?: ((item: QueueItem) => void) | undefined;
  onQueueProgress?: ((completed: number, total: number, percentage: number) => void) | undefined;
  onAllComplete?: ((successfulItems: QueueItem[], failedItems: QueueItem[]) => void) | undefined;
}

interface ResolvedUploadQueueOptions {
  concurrency: number;
  uploadEndpoint: string;
  headers: Record<string, string>;
  onItemProgress: (item: QueueItem) => void;
  onItemComplete: (item: QueueItem) => void;
  onQueueProgress: (completed: number, total: number, percentage: number) => void;
  onAllComplete: (successfulItems: QueueItem[], failedItems: QueueItem[]) => void;
}

export class BoundedUploadQueue {
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private aborted = false;
  private options: ResolvedUploadQueueOptions;

  constructor(options: UploadQueueOptions = {}) {
    this.options = {
      concurrency: options.concurrency ?? 3,
      uploadEndpoint: options.uploadEndpoint ?? "/v1/admin/church/media",
      headers: options.headers ?? {},
      onItemProgress: options.onItemProgress ?? (() => {}),
      onItemComplete: options.onItemComplete ?? (() => {}),
      onQueueProgress: options.onQueueProgress ?? (() => {}),
      onAllComplete: options.onAllComplete ?? (() => {}),
    };
  }

  addFiles(files: Array<{ file: File; relativePath?: string | undefined; inferredAltText?: string | undefined; inferredCaption?: string | undefined }>): QueueItem[] {
    const addedItems: QueueItem[] = [];
    for (const { file, relativePath, inferredAltText, inferredCaption } of files) {
      const item: QueueItem = {
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        relativePath: relativePath || file.name,
        status: "queued",
        progress: 0,
        ...(inferredAltText ? { inferredAltText } : {}),
        ...(inferredCaption ? { inferredCaption } : {}),
      };
      this.queue.push(item);
      addedItems.push(item);
    }
    this.updateOverallProgress();
    return addedItems;
  }

  getItems(): QueueItem[] {
    return [...this.queue];
  }

  start(): void {
    this.aborted = false;
    this.pump();
  }

  abort(): void {
    this.aborted = true;
  }

  clear(): void {
    this.queue = [];
    this.activeCount = 0;
    this.aborted = false;
  }

  private pump(): void {
    if (this.aborted) return;

    while (this.activeCount < this.options.concurrency) {
      const nextItem = this.queue.find((item) => item.status === "queued");
      if (!nextItem) break;

      this.activeCount++;
      nextItem.status = "uploading";
      this.options.onItemProgress(nextItem);
      this.updateOverallProgress();

      this.uploadSingleFile(nextItem)
        .then(() => {
          this.activeCount--;
          this.options.onItemComplete(nextItem);
          this.updateOverallProgress();
          this.pump();
          this.checkFinished();
        })
        .catch((err) => {
          this.activeCount--;
          nextItem.status = "error";
          nextItem.error = err instanceof Error ? err.message : "Upload failed";
          this.options.onItemComplete(nextItem);
          this.updateOverallProgress();
          this.pump();
          this.checkFinished();
        });
    }
  }

  private updateOverallProgress(): void {
    const total = this.queue.length;
    if (total === 0) return;
    const completed = this.queue.filter((i) => i.status === "success" || i.status === "error").length;
    const percentage = Math.round((completed / total) * 100);
    this.options.onQueueProgress(completed, total, percentage);
  }

  private checkFinished(): void {
    if (this.activeCount === 0 && !this.queue.some((i) => i.status === "queued" || i.status === "uploading")) {
      const successful = this.queue.filter((i) => i.status === "success");
      const failed = this.queue.filter((i) => i.status === "error");
      this.options.onAllComplete(successful, failed);
    }
  }

  private async uploadSingleFile(item: QueueItem): Promise<void> {
    const query = new URLSearchParams({
      filename: item.file.name,
      contentType: item.file.type || "image/jpeg",
    });

    const res = await fetch(`${this.options.uploadEndpoint}?${query}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/octet-stream",
        ...this.options.headers,
      },
      body: item.file,
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      throw new Error(body?.message ?? body?.error ?? `Upload failed (${res.status})`);
    }

    const payload = (await res.json()) as { asset: QueueItem["asset"] };
    item.status = "success";
    item.progress = 100;
    item.asset = payload.asset;
  }
}
