import { describe, it, expect } from 'vitest';
import { parseV2Template } from './importService';
import ExcelJS from 'exceljs';

describe('importService', () => {
  it('should parse a valid V2 Excel template', async () => {
    // Create a mock workbook using exceljs
    const workbook = new ExcelJS.Workbook();

    // Add worksheets matching V2 template structure
    const sheets = [
      '01_FACULTIES',
      '02_DEPARTMENTS',
      '03_PROGRAMS',
      '04_COURSES',
      '05_PROG_COURSES',
      '06_STAFF',
      '07_STUDENTS',
      '08_ENROLLMENTS',
      '09_GRADES'
    ];

    for (const sheetName of sheets) {
      const sheet = workbook.addWorksheet(sheetName);
      // Let's add headers
      sheet.addRow(['id', 'code', 'name']);
      // Add data row
      sheet.addRow(['1', 'CODE-A', `Name ${sheetName}`]);
    }

    // Write workbook to buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Create a File object
    const file = new File([buffer], 'template.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const result = await parseV2Template(file);

    // Verify properties
    expect(result).toHaveProperty('faculties');
    expect(result).toHaveProperty('departments');
    expect(result).toHaveProperty('programs');
    expect(result).toHaveProperty('courses');
    expect(result).toHaveProperty('program_courses');
    expect(result).toHaveProperty('staff');
    expect(result).toHaveProperty('students');
    expect(result).toHaveProperty('enrollments');
    expect(result).toHaveProperty('grades');

    expect(result.faculties).toHaveLength(1);
    expect(result.faculties[0]).toEqual({ id: '1', code: 'CODE-A', name: 'Name 01_FACULTIES' });
  });

  it('should reject files that are too large', async () => {
    // Create a dummy large file (e.g. 11MB)
    const largeBuffer = new Uint8Array(11 * 1024 * 1024);
    const file = new File([largeBuffer], 'too_large.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    await expect(parseV2Template(file)).rejects.toThrow('File too large');
  });

  it('should reject invalid mime types', async () => {
    const file = new File(['dummy content'], 'text.txt', {
      type: 'text/plain'
    });

    await expect(parseV2Template(file)).rejects.toThrow('Invalid file type');
  });
});









