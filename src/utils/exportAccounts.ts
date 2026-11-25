import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Account, Transaction } from '../types/finance';
import { calculateAccountBalance, formatCurrencyAmount } from './accountMetrics';
import { formatDateYYYYMMDD } from './localeDetection';

export interface ExportAccountsLabels {
  reportTitle: string;
  accountHolder: string;
  generatedDate: string;
  globalCurrency: string;
  appliedFilters: string;
  colName: string;
  colType: string;
  colCurrency: string;
  colInitialBalance: string;
  colCurrentBalance: string;
  colConvertedBalance: string;
  totalLabel: string;
  poweredBy: string;
  typeLabels: Record<Account['type'], string>;
}

export interface ExportAccountsContext {
  transactions: Transaction[];
  accountHolder: string;
  globalCurrency: string;
  accentColor: string;
  appliedFiltersText: string;
  convertBetween: (amount: number, fromCurrency: string, toCurrency?: string) => number;
  labels: ExportAccountsLabels;
}

interface PreparedRow {
  name: string;
  typeLabel: string;
  currency: string;
  initialBalance: number;
  currentBalance: number;
  convertedBalance: number;
}

function getDateStamp(): string {
  return formatDateYYYYMMDD(new Date());
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [151, 242, 204];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return [151, 242, 204];
  return [r, g, b];
}

function prepareRows(accounts: Account[], ctx: ExportAccountsContext): {
  rows: PreparedRow[];
  totalConverted: number;
} {
  let totalConverted = 0;
  const rows: PreparedRow[] = accounts.map((acc) => {
    const currentBalance = calculateAccountBalance(acc, ctx.transactions);
    const convertedBalance = ctx.convertBetween(currentBalance, acc.currency, ctx.globalCurrency);
    totalConverted += convertedBalance;
    return {
      name: acc.name,
      typeLabel: ctx.labels.typeLabels[acc.type] ?? acc.type,
      currency: acc.currency,
      initialBalance: acc.initialBalance,
      currentBalance,
      convertedBalance,
    };
  });
  return { rows, totalConverted };
}

export function exportAccountsToExcel(accounts: Account[], ctx: ExportAccountsContext): void {
  const { rows, totalConverted } = prepareRows(accounts, ctx);
  const dateStamp = getDateStamp();
  const { labels } = ctx;

  const convertedHeader = `${labels.colConvertedBalance} (${ctx.globalCurrency})`;

  const sheetData: (string | number)[][] = [
    [labels.reportTitle],
    [labels.accountHolder, ctx.accountHolder],
    [labels.generatedDate, new Date().toLocaleString()],
    [labels.globalCurrency, ctx.globalCurrency],
    [labels.appliedFilters, ctx.appliedFiltersText],
    [],
    [
      labels.colName,
      labels.colType,
      labels.colCurrency,
      labels.colInitialBalance,
      labels.colCurrentBalance,
      convertedHeader,
    ],
    ...rows.map((r) => [
      r.name,
      r.typeLabel,
      r.currency,
      Number(r.initialBalance.toFixed(2)),
      Number(r.currentBalance.toFixed(2)),
      Number(r.convertedBalance.toFixed(2)),
    ]),
    [],
    [
      labels.totalLabel,
      '',
      ctx.globalCurrency,
      '',
      '',
      Number(totalConverted.toFixed(2)),
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Auto-fit column widths cleanly
  const colCount = 6;
  const colWidths = Array.from({ length: colCount }, (_, colIdx) => {
    let maxLen = 12;
    for (const row of sheetData) {
      const cell = row[colIdx];
      if (cell !== undefined && cell !== null) {
        maxLen = Math.max(maxLen, String(cell).length + 3);
      }
    }
    return { wch: Math.min(maxLen, 36) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Growy Accounts');
  XLSX.writeFile(workbook, `growy-accounts-${dateStamp}.xlsx`);
}

export function exportAccountsToPDF(accounts: Account[], ctx: ExportAccountsContext): void {
  const { rows, totalConverted } = prepareRows(accounts, ctx);
  const dateStamp = getDateStamp();
  const { labels } = ctx;
  const accentRgb = hexToRgb(ctx.accentColor);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Dark Charcoal Header Band
  doc.setFillColor(26, 26, 28);
  doc.rect(0, 0, pageWidth, 118, 'F');

  // Accent bar
  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Title & Metadata
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(labels.reportTitle, 40, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(184, 184, 190);
  doc.text(`${labels.accountHolder}: ${ctx.accountHolder}`, 40, 64);
  doc.text(`${labels.generatedDate}: ${new Date().toLocaleString()}`, 40, 80);
  doc.text(`${labels.appliedFilters}: ${ctx.appliedFiltersText}`, 40, 96);

  // Right-aligned Total Summary in Header
  doc.setFontSize(9);
  doc.setTextColor(184, 184, 190);
  doc.text(`${labels.totalLabel} (${ctx.globalCurrency})`, pageWidth - 40, 44, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.text(formatCurrencyAmount(totalConverted, ctx.globalCurrency), pageWidth - 40, 68, {
    align: 'right',
  });

  const convertedHeader = `${labels.colConvertedBalance} (${ctx.globalCurrency})`;

  autoTable(doc, {
    startY: 138,
    margin: { left: 40, right: 40, bottom: 56 },
    head: [
      [
        labels.colName,
        labels.colType,
        labels.colCurrency,
        labels.colInitialBalance,
        labels.colCurrentBalance,
        convertedHeader,
      ],
    ],
    body: rows.map((r) => [
      r.name,
      r.typeLabel,
      r.currency,
      formatCurrencyAmount(r.initialBalance, r.currency),
      formatCurrencyAmount(r.currentBalance, r.currency),
      formatCurrencyAmount(r.convertedBalance, ctx.globalCurrency),
    ]),
    foot: [
      [
        labels.totalLabel,
        '',
        ctx.globalCurrency,
        '',
        '',
        formatCurrencyAmount(totalConverted, ctx.globalCurrency),
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 7,
      textColor: [30, 30, 34],
      lineColor: [224, 226, 230],
      lineWidth: 0.6,
    },
    headStyles: {
      fillColor: [51, 51, 51],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    footStyles: {
      fillColor: [242, 244, 247],
      textColor: [26, 26, 28],
      fontStyle: 'bold',
      fontSize: 9.5,
    },
    columnStyles: {
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: () => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(130, 130, 138);
      doc.text(`${labels.poweredBy} SIMPORA`, 40, pageHeight - 24);
      doc.text(dateStamp, pageWidth - 40, pageHeight - 24, { align: 'right' });
    },
  });

  doc.save(`growy-accounts-${dateStamp}.pdf`);
}

