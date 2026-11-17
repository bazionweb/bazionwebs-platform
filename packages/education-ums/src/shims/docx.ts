export const AlignmentType = { LEFT: "left", CENTER: "center", RIGHT: "right", JUSTIFIED: "both" } as const;
export const BorderStyle = { SINGLE: "single", NONE: "none", DOUBLE: "double", DOTTED: "dotted" } as const;
export const WidthType = { PERCENTAGE: "pct", DXA: "dxa", AUTO: "auto" } as const;
export const VerticalAlign = { TOP: "top", CENTER: "center", BOTTOM: "bottom" } as const;
export const ShadingType = { SOLID: "solid", CLEAR: "clear" } as const;
export const HeadingLevel = { HEADING_1: "Heading1", HEADING_2: "Heading2", HEADING_3: "Heading3" } as const;

export function convertInchesToTwip(inches: number): number {
  return Math.round(inches * 1440);
}

export class TextRun {
  constructor(public options?: Record<string, unknown> | string) {}
}

export class ImageRun {
  constructor(public options?: Record<string, unknown>) {}
}

export class Paragraph {
  constructor(public options?: Record<string, unknown> | string) {}
}

export class TableCell {
  constructor(public options?: Record<string, unknown>) {}
}

export class TableRow {
  constructor(public options?: Record<string, unknown>) {}
}

export class Table {
  constructor(public options?: Record<string, unknown>) {}
}

export class Document {
  constructor(public options?: Record<string, unknown>) {}
}

export const Packer = {
  async toBlob(_doc: Document): Promise<Blob> {
    return new Blob([""], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  },
};

