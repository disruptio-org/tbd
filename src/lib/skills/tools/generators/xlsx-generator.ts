/**
 * XLSX Generator — Converts structured tabular data to .xlsx buffer
 */

import * as XLSX from 'xlsx';

interface SheetData {
    name: string;
    headers: string[];
    rows: string[][];
}

interface SpreadsheetData {
    title: string;
    sheets: SheetData[];
    summary: string;
}

/**
 * Generate an XLSX file buffer from structured spreadsheet data.
 */
export function generateXlsx(data: SpreadsheetData): Buffer {
    const workbook = XLSX.utils.book_new();
    workbook.Props = {
        Title: data.title,
        Author: 'Nousio',
        CreatedDate: new Date(),
        Comments: data.summary,
    };

    for (const sheet of data.sheets) {
        // Combine headers + rows into a 2D array
        const aoa: string[][] = [sheet.headers, ...sheet.rows];
        const worksheet = XLSX.utils.aoa_to_sheet(aoa);

        // Auto-width columns
        const colWidths = sheet.headers.map((header, i) => {
            const maxLen = Math.max(
                header.length,
                ...sheet.rows.map(row => (row[i] || '').length)
            );
            return { wch: Math.min(maxLen + 2, 50) };
        });
        worksheet['!cols'] = colWidths;

        // Add sheet to workbook
        const sheetName = sheet.name.substring(0, 31); // Excel 31-char limit
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    // If there's a summary, add it as a separate sheet
    if (data.summary) {
        const summarySheet = XLSX.utils.aoa_to_sheet([
            ['Summary'],
            [data.summary],
        ]);
        summarySheet['!cols'] = [{ wch: 80 }];
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buffer);
}
