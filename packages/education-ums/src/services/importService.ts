import ExcelJS from '../shims/exceljs';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface V2ImportData {
  faculties: any[];
  departments: any[];
  programs: any[];
  courses: any[];
  program_courses: any[];
  staff: any[];
  students: any[];
  enrollments: any[];
  grades: any[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function parseV2Template(file: File): Promise<V2ImportData> {
  // Enforce a 10MB file size limit before parsing.
  // Validate MIME type to prevent non-spreadsheet files.
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Promise.reject(
      new Error(`File too large. Maximum allowed size is 10 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`)
    );
  }

  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return Promise.reject(
      new Error(`Invalid file type "${file.type}". Only .xlsx and .xls files are accepted.`)
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target!.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        workbook.xlsx.load(data).then(() => {
          const getSheetData = (sheetName: string) => {
            const worksheet = workbook.getWorksheet(sheetName);
            if (!worksheet) return [];

            const list: unknown[] = [];
            const headerRow = worksheet.getRow(1);
            const headers: string[] = [];
            const colCount = worksheet.columnCount || 100;

            for (let c = 1; c <= colCount; c++) {
              const val = headerRow.getCell(c).value;
              headers.push(val !== null && val !== undefined ? val.toString().trim() : '');
            }

            worksheet.eachRow((row, rowNumber) => {
              if (rowNumber === 1) return; // skip header
              const rowData: Record<string, string> = {};
              let hasData = false;
              for (let c = 1; c <= headers.length; c++) {
                const header = headers[c - 1];
                if (!header) continue;

                const cell = row.getCell(c);
                let val = cell.value;

                // Handle rich text, formula results, and object structures
                if (val && typeof val === 'object') {
                  if ('result' in val) {
                    val = (val as { result: string }).result;
                  } else if ('text' in val) {
                    val = (val as { text: string }).text;
                  } else if (Array.isArray((val as { richText: Array<{ text: string }> }).richText)) {
                    val = (val as { richText: Array<{ text: string }> }).richText.map(
                    (rt: { text: string }) => rt.text || '').join('');
                  }
                }

                const valStr = val !== null && val !== undefined ? val.toString().trim() : '';
                rowData[header] = valStr;
                if (valStr !== '') {
                  hasData = true;
                }
              }
              if (hasData) {
                list.push(rowData);
              }
            });
            return list;
          };

          const result: V2ImportData = {
            faculties: getSheetData('01_FACULTIES'),
            departments: getSheetData('02_DEPARTMENTS'),
            programs: getSheetData('03_PROGRAMS'),
            courses: getSheetData('04_COURSES'),
            program_courses: getSheetData('05_PROG_COURSES'),
            staff: getSheetData('06_STAFF'),
            students: getSheetData('07_STUDENTS'),
            enrollments: getSheetData('08_ENROLLMENTS'),
            grades: getSheetData('09_GRADES'),
          };

          resolve(result);
        }).catch(() => {
          reject(new Error('Failed to parse V2 template. Ensure it is a valid .xlsx file matching the V2 structure.'));
        });
      } catch { reject(new Error('Failed to parse V2 template. Ensure it is a valid .xlsx file matching the V2 structure.'));
       }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}










