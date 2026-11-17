/* eslint-disable @typescript-eslint/no-explicit-any */
export class jsPDF {
  internal: any = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
  constructor(..._args: any[]) {}
  addImage(..._args: any[]) {}
  text(..._args: any[]) {}
  setFontSize(..._args: any[]) {}
  setFont(..._args: any[]) {}
  setTextColor(..._args: any[]) {}
  setDrawColor(..._args: any[]) {}
  setFillColor(..._args: any[]) {}
  rect(..._args: any[]) {}
  line(..._args: any[]) {}
  addPage(..._args: any[]) {}
  setProperties(..._args: any[]) {}
  save(_filename?: string) {
    if (typeof window !== "undefined") window.print();
  }
  output(_type?: string): Blob {
    return new Blob([""], { type: "application/pdf" });
  }
}

export default jsPDF;
