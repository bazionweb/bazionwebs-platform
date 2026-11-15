/* eslint-disable @typescript-eslint/no-explicit-any */
export type NeonQueryFunction<A = any, B = any> = ((strings: any, ...params: any[]) => Promise<any>) & {
  query?: (sql: string, params?: any[]) => Promise<any>;
  transaction?: (arg: any[] | ((txn: any) => any[])) => Promise<any[]>;
};

export const neonConfig: Record<string, any> = {};

export function neon(_url: string): NeonQueryFunction {
  const fn: any = async () => [];
  fn.query = async () => [];
  fn.transaction = async (arg: any) => (typeof arg === "function" ? [] : []);
  return fn;
}

class Stripe {
  paymentIntents = {
    create: async (params: any): Promise<Stripe.PaymentIntent> => ({
      id: `pi_sim_${Date.now()}`,
      client_secret: `secret_sim_${Date.now()}`,
      status: "requires_payment_method",
      amount: params?.amount ?? 0,
      currency: params?.currency ?? "usd",
    }),
    retrieve: async (id: string): Promise<Stripe.PaymentIntent> => ({
      id,
      client_secret: `secret_${id}`,
      status: "succeeded",
      amount: 0,
      currency: "usd",
    }),
    cancel: async (id: string): Promise<Stripe.PaymentIntent> => ({
      id,
      client_secret: null,
      status: "canceled",
      amount: 0,
      currency: "usd",
    }),
  };
  webhooks = {
    constructEvent: (payload: string | Buffer, _sig?: string, _secret?: string): Stripe.Event =>
      typeof payload === "string" ? JSON.parse(payload) : JSON.parse(payload.toString("utf8")),
  };
  constructor(_apiKey?: string, _config?: any) {}
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Stripe {
  export type Event = { id: string; type: string; data: { object: any } };
  export type PaymentIntent = { id: string; client_secret: string | null; status: string; amount: number; currency: string };
}

export { Stripe };
export default Stripe;

export class PDFDocument {
  static async create(): Promise<PDFDocument> {
    return new PDFDocument();
  }
  static async load(_data: any): Promise<PDFDocument> {
    return new PDFDocument();
  }
  getPageCount(): number {
    return 1;
  }
  addPage(_size?: [number, number]): any {
    return {
      getSize: () => ({ width: 595, height: 842 }),
      drawText: () => {},
      drawRectangle: () => {},
      drawLine: () => {},
      drawImage: () => {},
    };
  }
  async embedFont(_font: any): Promise<any> {
    return { widthOfTextAtSize: (text: string, size: number) => text.length * size * 0.5 };
  }
  async embedPng(_bytes: any): Promise<any> {
    return { width: 100, height: 100, scale: () => ({ width: 100, height: 100 }) };
  }
  async embedJpg(_bytes: any): Promise<any> {
    return { width: 100, height: 100, scale: () => ({ width: 100, height: 100 }) };
  }
  async save(): Promise<Uint8Array> {
    const header = "%PDF-1.4\n% Bazion Education PDF Document\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n110\n%%EOF\n";
    return new Uint8Array(Buffer.from(header, "utf8"));
  }
}

export const StandardFonts = {
  Helvetica: "Helvetica",
  HelveticaBold: "Helvetica-Bold",
  TimesRoman: "Times-Roman",
  TimesRomanBold: "Times-Roman-Bold",
  TimesRomanItalic: "Times-Roman-Italic",
} as const;

export function rgb(r: number, g: number, b: number) {
  return { r, g, b };
}

export type PDFFont = any;
export type PDFImage = any;

export class OpenAPIRegistry {
  definitions: any[] = [];
  register(_name: string, schema: any) {
    this.definitions.push(schema);
    return schema;
  }
  registerPath(config: any) {
    this.definitions.push(config);
  }
  registerComponent(_type: string, _name: string, _component: any) {}
}

export class OpenApiGeneratorV3 {
  constructor(private readonly definitions: any[]) {}
  generateDocument(config: any) {
    return { openapi: "3.0.0", ...config, paths: {}, components: { schemas: {} }, definitions: this.definitions };
  }
}

export type OpenAPIObjectConfig = Record<string, any>;
