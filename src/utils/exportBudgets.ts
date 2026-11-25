import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Account, BudgetCategory, Transaction } from '../types/finance';
import { formatCurrencyAmount } from './accountMetrics';
import { calculateCategoryMetrics } from './budgetMetrics';
import { formatDateYYYYMMDD } from './localeDetection';

export interface ExportBudgetsLabels {
  reportTitle: string;
  accountHolder: string;
  generatedDate: string;
  globalCurrency: string;
  activeTabLabel: string;
  appliedFilters: string;
  colCategory: string;
  colType: string;
  colTarget: string;
  colActual: string;
  colRemaining: string;
  colProgress: string;
  colStatus: string;
  totalLabel: string;
  poweredBy: string;
  kindLabels: Record<'expense' | 'income', string>;
  statusLabels: Record<string, string>;
}

export interface ExportBudgetsContext {
  transactions: Transaction[];
  accounts: Account[];
  accountHolder: string;
  globalCurrency: string;
  accentColor: string;
  activeTabText: string;
  appliedFiltersText: string;
  convertBetween: (amount: number, fromCurrency: string, toCurrency?: string) => number;
  labels: ExportBudgetsLabels;
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

export function exportBudgetsToExcel(
  categories: BudgetCategory[],
  ctx: ExportBudgetsContext
): void {
  const dateStamp = getDateStamp();
  const { labels } = ctx;
  const convert = (amount: number, from: string) =>
    ctx.convertBetween(amount, from, ctx.globalCurrency);

  let totalTarget = 0;
  let totalActual = 0;
  let totalRemaining = 0;

  const dataRows = categories.map((cat) => {
    const m = calculateCategoryMetrics(
      cat,
      ctx.transactions,
      ctx.accounts,
      convert,
      undefined,
      ctx.globalCurrency
    );
    totalTarget += m.target;
    totalActual += m.actual;
    totalRemaining += m.remaining;
    return [
      cat.name,
      labels.kindLabels[cat.kind],
      Number(m.target.toFixed(2)),
      Number(m.actual.toFixed(2)),
      Number(m.remaining.toFixed(2)),
      `${m.progressPct.toFixed(1)}%`,
      labels.statusLabels[m.status] ?? m.status,
    ];
  });

  const totalPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

  const sheetData: (string | number)[][] = [
    [labels.reportTitle],
    [labels.accountHolder, ctx.accountHolder],
    [labels.generatedDate, new Date().toLocaleString()],
    [labels.globalCurrency, ctx.globalCurrency],
    [labels.activeTabLabel, ctx.activeTabText],
    [labels.appliedFilters, ctx.appliedFiltersText],
    [],
    [
      labels.colCategory,
      labels.colType,
      `${labels.colTarget} (${ctx.globalCurrency})`,
      `${labels.colActual} (${ctx.globalCurrency})`,
      `${labels.colRemaining} (${ctx.globalCurrency})`,
      labels.colProgress,
      labels.colStatus,
    ],
    ...dataRows,
    [],
    [
      labels.totalLabel,
      '',
      Number(totalTarget.toFixed(2)),
      Number(totalActual.toFixed(2)),
      Number(totalRemaining.toFixed(2)),
      `${totalPct.toFixed(1)}%`,
      '',
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const colWidths = Array.from({ length: 7 }, (_, colIdx) => {
    let maxLen = 12;
    for (const row of sheetData) {
      const cell = row[colIdx];
      if (cell !== undefined && cell !== null) {
        maxLen = Math.max(maxLen, String(cell).length + 3);
      }
    }
    return { wch: Math.min(maxLen, 34) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Growy Budgets');
  XLSX.writeFile(workbook, `growy-budgets-${dateStamp}.xlsx`);
}

export function exportBudgetsToPDF(
  categories: BudgetCategory[],
  ctx: ExportBudgetsContext
): void {
  const dateStamp = getDateStamp();
  const { labels } = ctx;
  const accentRgb = hexToRgb(ctx.accentColor);
  const convert = (amount: number, from: string) =>
    ctx.convertBetween(amount, from, ctx.globalCurrency);

  let totalTarget = 0;
  let totalActual = 0;
  let totalRemaining = 0;

  const bodyRows = categories.map((cat) => {
    const m = calculateCategoryMetrics(
      cat,
      ctx.transactions,
      ctx.accounts,
      convert,
      undefined,
      ctx.globalCurrency
    );
    totalTarget += m.target;
    totalActual += m.actual;
    totalRemaining += m.remaining;
    return [
      cat.name,
      labels.kindLabels[cat.kind],
      formatCurrencyAmount(m.target, ctx.globalCurrency),
      formatCurrencyAmount(m.actual, ctx.globalCurrency),
      formatCurrencyAmount(m.remaining, ctx.globalCurrency),
      `${m.progressPct.toFixed(1)}%`,
      labels.statusLabels[m.status] ?? m.status,
    ];
  });

  const totalPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Dark Charcoal Header
  doc.setFillColor(26, 26, 28);
  doc.rect(0, 0, pageWidth, 126, 'F');

  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.rect(0, 0, pageWidth, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(labels.reportTitle, 40, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(184, 184, 190);
  doc.text(`${labels.accountHolder}: ${ctx.accountHolder}`, 40, 62);
  doc.text(`${labels.activeTabLabel}: ${ctx.activeTabText}`, 40, 78);
  doc.text(`${labels.appliedFilters}: ${ctx.appliedFiltersText}`, 40, 94);
  doc.text(`${labels.generatedDate}: ${new Date().toLocaleString()}`, 40, 110);

  doc.setFontSize(9);
  doc.setTextColor(184, 184, 190);
  doc.text(`${labels.totalLabel} (${ctx.globalCurrency})`, pageWidth - 40, 44, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.text(formatCurrencyAmount(totalTarget, ctx.globalCurrency), pageWidth - 40, 68, {
    align: 'right',
  });

  autoTable(doc, {
    startY: 146,
    margin: { left: 40, right: 40, bottom: 56 },
    head: [
      [
        labels.colCategory,
        labels.colType,
        labels.colTarget,
        labels.colActual,
        labels.colRemaining,
        labels.colProgress,
        labels.colStatus,
      ],
    ],
    body: bodyRows,
    foot: [
      [
        labels.totalLabel,
        '',
        formatCurrencyAmount(totalTarget, ctx.globalCurrency),
        formatCurrencyAmount(totalActual, ctx.globalCurrency),
        formatCurrencyAmount(totalRemaining, ctx.globalCurrency),
        `${totalPct.toFixed(1)}%`,
        '',
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
      2: { halign: 'right' },
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

  doc.save(`growy-budgets-${dateStamp}.pdf`);
}

