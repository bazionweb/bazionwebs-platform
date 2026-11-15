export function saveAs(data: Blob | string, filename = "download") {
  if (typeof window === "undefined") return;
  const url = typeof data === "string" ? data : URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  if (typeof data !== "string") setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default saveAs;

