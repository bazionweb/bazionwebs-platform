export class Worksheet {
  name: string;
  columns: Array<Record<string, unknown>> = [];
  private rows: Array<Array<unknown>> = [];

  constructor(name: string) {
    this.name = name;
  }

  get columnCount(): number {
    return this.rows[0]?.length ?? this.columns.length ?? 0;
  }

  addRow(values: Array<unknown> | Record<string, unknown>) {
    const arr = Array.isArray(values) ? values : Object.values(values);
    this.rows.push(arr);
  }

  getRow(rowNumber: number) {
    const row = this.rows[rowNumber - 1] ?? [];
    return {
      getCell: (colNumber: number) => ({
        value: row[colNumber - 1] ?? null,
      }),
    };
  }

  eachRow(callback: (row: { getCell: (c: number) => { value: unknown } }, rowNumber: number) => void) {
    this.rows.forEach((_, idx) => callback(this.getRow(idx + 1), idx + 1));
  }
}

export class Workbook {
  private sheets: Worksheet[] = [];

  addWorksheet(name: string): Worksheet {
    const ws = new Worksheet(name);
    this.sheets.push(ws);
    return ws;
  }

  getWorksheet(nameOrId: string | number): Worksheet | undefined {
    if (typeof nameOrId === "number") return this.sheets[nameOrId - 1];
    return this.sheets.find((s) => s.name === nameOrId);
  }

  xlsx = {
    load: async (_buffer: ArrayBuffer): Promise<Workbook> => this,
    writeBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(0),
  };
}

export default { Workbook, Worksheet };

