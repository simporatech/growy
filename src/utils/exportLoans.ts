import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Loan, LoanDirection } from '../types/finance';
import { formatCurrencyAmount } from './accountMetrics';
import {
  calculateLoanSummary,
  getLoanProgressPct,
  getLoanRemaining,
  isLoanOverdue,
  isLoanSettled,
} from './loanMetrics';
import { formatDateYYYYMMDD } from './localeDetection';

export interface ExportLoansLabels {
  reportTitle: string;
  accountHolder: string;
  generatedDate: string;
  globalCurrency: string;
  appliedFilters: string;
  colTitle: string;
  colDirection: string;
  colCounterparty: string;
  colPrincipal: string;
  colPaid: string;
  colRemaining: string;
  colProgress: string;
  colDueDate: string;
  colStatus: string;
  statusActive: string;
  statusSettled: string;
  statusOverdue: string;
  totalReceivable: string;
  totalPayable: string;
  netPosition: string;
  poweredBy: string;
  directionLabels: Record<LoanDirection, string>;
}

export interface ExportLoansContext {
  accountHolder: string;
  globalCurrency: string;
  accentColor: string;
  appliedFiltersText: string;
  timezone?: string;
  convertBetween: (amount: number, fromCurrency: string, toCurrency?: string) => number;
  labels: ExportLoansLabels;
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

export function exportLoansToExcel(loans: Loan[], ctx: ExportLoansContext): void {
  const dateStamp = formatDateYYYYMMDD(new Date(), ctx.timezone);
  const { labels } = ctx;
  const convertToGlobal = (amount: number, from: string) =>
    ctx.convertBetween(amount, from, ctx.globalCurrency);
  const summary = calculateLoanSummary(loans, convertToGlobal);

  const rows = loans.map((loan) => {
    const remaining = getLoanRemaining(loan);
    const pct = getLoanProgressPct(loan);
    const statusText = isLoanSettled(loan)
      ? labels.statusSettled
      : isLoanOverdue(loan, ctx.timezone)
        ? labels.statusOverdue
        : labels.statusActive;

    return [
      loan.title,
      labels.directionLabels[loan.direction],
      loan.counterparty ?? '—',
      formatCurrencyAmount(loan.principalAmount, loan.currency),
      formatCurrencyAmount(loan.paidAmount, loan.currency),
      formatCurrencyAmount(remaining, loan.currency),
      `${pct.toFixed(1)}%`,
      loan.dueDate,
      statusText,
    ];
  });

  const sheetData: (string | number)[][] = [
    [labels.reportTitle],
    [labels.accountHolder, ctx.accountHolder],
    [labels.generatedDate, new Date().toLocaleString()],
    [labels.globalCurrency, ctx.globalCurrency],
    [labels.appliedFilters, ctx.appliedFiltersText],
    [],
    [
      labels.colTitle,
      labels.colDirection,
      labels.colCounterparty,
      labels.colPrincipal,
      labels.colPaid,
      labels.colRemaining,
      labels.colProgress,
      labels.colDueDate,
      labels.colStatus,
    ],
    ...rows,
    [],
    [labels.totalReceivable, '', '', '', '', Number(summary.totalReceivable.toFixed(2)), '', '', ''],
    [labels.totalPayable, '', '', '', '', Number(summary.totalPayable.toFixed(2)), '', '', ''],
    [labels.netPosition, '', '', '', '', Number(summary.netLoanPosition.toFixed(2)), '', '', ''],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = Array.from({ length: 9 }, (_, colIdx) => {
    let maxLen = 12;
    for (const row of sheetData) {
      const cell = row[colIdx];
      if (cell !== undefined && cell !== null) {
        maxLen = Math.max(maxLen, String(cell).length + 3);
      }
    }
    return { wch: Math.min(maxLen, 34) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Growy Loans');
  XLSX.writeFile(workbook, `growy-loans-${dateStamp}.xlsx`);
}

export function exportLoansToPDF(loans: Loan[], ctx: ExportLoansContext): void {
  const dateStamp = formatDateYYYYMMDD(new Date(), ctx.timezone);
  const { labels } = ctx;
  const accentRgb = hexToRgb(ctx.accentColor);
  const convertToGlobal = (amount: number, from: string) =>
    ctx.convertBetween(amount, from, ctx.globalCurrency);
  const summary = calculateLoanSummary(loans, convertToGlobal);

  const bodyRows = loans.map((loan) => {
    const remaining = getLoanRemaining(loan);
    const pct = getLoanProgressPct(loan);
    const statusText = isLoanSettled(loan)
      ? labels.statusSettled
      : isLoanOverdue(loan, ctx.timezone)
        ? labels.statusOverdue
        : labels.statusActive;

    return [
      loan.title,
      labels.directionLabels[loan.direction],
      loan.counterparty ?? '—',
      formatCurrencyAmount(loan.principalAmount, loan.currency),
      formatCurrencyAmount(loan.paidAmount, loan.currency),
      formatCurrencyAmount(remaining, loan.currency),
      `${pct.toFixed(1)}%`,
      loan.dueDate,
      statusText,
    ];
  });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(26, 26, 28);
  doc.rect(0, 0, pageWidth, 88, 'F');
  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.rect(0, 86, pageWidth, 2.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(labels.reportTitle, 40, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(184, 184, 190);
  doc.text(`${labels.accountHolder}: ${ctx.accountHolder}`, 40, 58);
  doc.text(`${labels.generatedDate}: ${new Date().toLocaleString()}`, 40, 73);
  doc.text(`${labels.globalCurrency}: ${ctx.globalCurrency}`, pageWidth - 40, 58, {
    align: 'right',
  });

  doc.setTextColor(80, 80, 90);
  doc.setFontSize(9.5);
  doc.text(`${labels.appliedFilters}: ${ctx.appliedFiltersText}`, 40, 110);

  autoTable(doc, {
    startY: 124,
    head: [
      [
        labels.colTitle,
        labels.colDirection,
        labels.colCounterparty,
        labels.colPrincipal,
        labels.colPaid,
        labels.colRemaining,
        labels.colProgress,
        labels.colDueDate,
        labels.colStatus,
      ],
    ],
    body: bodyRows,
    foot: [
      [
        labels.totalReceivable,
        '',
        '',
        '',
        '',
        formatCurrencyAmount(summary.totalReceivable, ctx.globalCurrency),
        '',
        '',
        '',
      ],
      [
        labels.totalPayable,
        '',
        '',
        '',
        '',
        formatCurrencyAmount(summary.totalPayable, ctx.globalCurrency),
        '',
        '',
        '',
      ],
      [
        labels.netPosition,
        '',
        '',
        '',
        '',
        formatCurrencyAmount(summary.netLoanPosition, ctx.globalCurrency),
        '',
        '',
        '',
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 6,
      textColor: [30, 30, 34],
      lineColor: [225, 226, 232],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [34, 34, 38],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: [244, 245, 248],
      textColor: [20, 20, 24],
      fontStyle: 'bold',
    },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    margin: { left: 40, right: 40 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8.5);
    doc.setTextColor(140, 140, 150);
    doc.text(labels.poweredBy, 40, pageHeight - 24);
    doc.text(`${i} / ${pageCount}`, pageWidth - 40, pageHeight - 24, { align: 'right' });
  }

  doc.save(`growy-loans-${dateStamp}.pdf`);
}

