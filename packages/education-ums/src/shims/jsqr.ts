export interface QRCodeResult {
  data: string;
}

export default function jsQR(
  _data: Uint8ClampedArray,
  _width: number,
  _height: number,
  _options?: Record<string, unknown>
): QRCodeResult | null {
  return null;
}
