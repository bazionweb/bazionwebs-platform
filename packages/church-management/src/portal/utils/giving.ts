/**
 * Generates a CSV string representation of giving records.
 */
export function generateCSV(
  records: { id: string; member: string; date: string; type: string; amount_kes: number; method: string }[],
): string {
  const header = 'Date,Type,Amount (KES),Method';
  if (!records || records.length === 0) {
    return header;
  }

  const rows = records.map((record) => {
    const date = escapeCSV(record.date);
    const type = escapeCSV(record.type);
    const amount = record.amount_kes.toString();
    const method = escapeCSV(record.method);
    return `${date},${type},${amount},${method}`;
  });

  return [header, ...rows].join('\n');
}

function escapeCSV(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
