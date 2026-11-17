export default async function html2canvas(
  _element: HTMLElement,
  _options?: Record<string, unknown>
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  return canvas;
}
