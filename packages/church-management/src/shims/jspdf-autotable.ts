/* eslint-disable @typescript-eslint/no-explicit-any */
export function autoTable(doc: any, options: any) {
  if (doc) {
    doc.lastAutoTable = { finalY: (options?.startY || 100) + ((options?.body?.length || 1) * 10) + 20 };
  }
  return doc;
}

export default autoTable;

