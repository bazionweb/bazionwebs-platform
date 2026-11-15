export async function toDataURL(text: string, _options?: Record<string, unknown>): Promise<string> {
  const safe = encodeURIComponent(text);
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="%23fff"/><rect x="12" y="12" width="36" height="36" fill="%230f172a"/><rect x="112" y="12" width="36" height="36" fill="%230f172a"/><rect x="12" y="112" width="36" height="36" fill="%230f172a"/><text x="80" y="84" font-size="10" text-anchor="middle" fill="%230f172a">QR:${safe.slice(0, 12)}</text></svg>`;
}

export async function toString(text: string): Promise<string> {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><text x="8" y="64">${text}</text></svg>`;
}

export async function toCanvas(_canvas: HTMLCanvasElement, _text: string): Promise<void> {}

export default { toDataURL, toString, toCanvas };

