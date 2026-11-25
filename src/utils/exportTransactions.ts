import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Account, BudgetCategory, Transaction } from '../types/finance';
import { formatCurrencyAmount } from './accountMetrics';
import { formatDateYYYYMMDD } from './localeDetection';
import {
  calculateTransactionSummary,
  getTransactionGlobalAmount,
} from './transactionMetrics';

export interface ExportTransactionsLabels {
  reportTitle: string;
  accountHolder: string;
  generatedDate: string;
  globalCurrency: string;
  appliedFilters: string;
  colDate: string;
  colType: string;
  colCategoryOrRoute: string;
  colAccounts: string;
  colDescription: string;
  colAmount: string;
  colConverted: string;
  totalIncome: string;
  totalExpenses: string;
  netCashFlow: string;
  poweredBy: string;
  typeLabels: Record<Transaction['type'], string>;
  transferRouteLabel: string;
  unknownLabel: string;
}

export interface ExportTransactionsContext {
  accounts: Account[];
  categories: BudgetCategory[];
  accountHolder: string;
  globalCurrency: string;
  accentColor: string;
  appliedFiltersText: string;
  convertBetween: (amount: number, fromCurrency: string, toCurrency?: string) => number;
  labels: ExportTransactionsLabels;
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

export function exportTransactionsToExcel(
  transactions: Transaction[],
  ctx: ExportTransactionsContext
): void {
  const dateStamp = getDateStamp();
  const { labels } = ctx;
  const accountMap = new Map(ctx.accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(ctx.categories.map((c) => [c.id, c]));

  const convertToGlobal = (amount: number, from: string) =>
    ctx.convertBetween(amount, from, ctx.globalCurrency);
  const summary = calculateTransactionSummary(
    transactions,
    ctx.accounts,
    convertToGlobal,
    ctx.globalCurrency
  );

  const rows = transactions.map((tx) => {
    const src = accountMap.get(tx.accountId);
    const dst = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;
    const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;

    const srcCurrency = src?.currency ?? 'USD';
    const converted =
      tx.type === 'transfer'
        ? convertToGlobal(tx.amount, srcCurrency)
        : getTransactionGlobalAmount(tx, srcCurrency, convertToGlobal, ctx.globalCurrency);

    const categoryOrRoute =
      tx.type === 'transfer'
        ? `${src?.name ?? labels.unknownLabel} → ${dst?.name ?? labels.unknownLabel}`
        : cat?.name ?? tx.category ?? labels.unknownLabel;

    const accountsText =
      tx.type === 'transfer'
        ? `${src?.name ?? labels.unknownLabel} (${srcCurrency}) → ${dst?.name ?? labels.unknownLabel} (${dst?.currency ?? srcCurrency})`
        : `${src?.name ?? labels.unknownLabel} (${srcCurrency})`;

    const amountDisplay =
      tx.type === 'transfer' && dst && src && dst.currency !== src.currency
        ? `${formatCurrencyAmount(tx.amount, src.currency)} → ${formatCurrencyAmount(tx.toAmount ?? tx.amount, dst.currency)}`
        : formatCurrencyAmount(tx.type === 'expense' ? -tx.amount : tx.amount, srcCurrency);

    return [
      tx.date,
      labels.typeLabels[tx.type],
      categoryOrRoute,
      accountsText,
      tx.description ?? '',
      amountDisplay,
      Number(converted.toFixed(2)),
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
      labels.colDate,
      labels.colType,
      labels.colCategoryOrRoute,
      labels.colAccounts,
      labels.colDescription,
      labels.colAmount,
      `${labels.colConverted} (${ctx.globalCurrency})`,
    ],
    ...rows,
    [],
    [labels.totalIncome, '', '', '', '', '', Number(summary.totalIncome.toFixed(2))],
    [labels.totalExpenses, '', '', '', '', '', Number(summary.totalExpenses.toFixed(2))],
    [labels.netCashFlow, '', '', '', '', '', Number(summary.netCashFlow.toFixed(2))],
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
    return { wch: Math.min(maxLen, 38) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Growy Transactions');
  XLSX.writeFile(workbook, `growy-transactions-${dateStamp}.xlsx`);
}

export function exportTransactionsToPDF(
  transactions: Transaction[],
  ctx: ExportTransactionsContext
): void {
  const dateStamp = getDateStamp();
  const { labels } = ctx;
  const accentRgb = hexToRgb(ctx.accentColor);
  const accountMap = new Map(ctx.accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(ctx.categories.map((c) => [c.id, c]));

  const convertToGlobal = (amount: number, from: string) =>
    ctx.convertBetween(amount, from, ctx.globalCurrency);
  const summary = calculateTransactionSummary(
    transactions,
    ctx.accounts,
    convertToGlobal,
    ctx.globalCurrency
  );

  const bodyRows = transactions.map((tx) => {
    const src = accountMap.get(tx.accountId);
    const dst = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;
    const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
    const srcCurrency = src?.currency ?? 'USD';
    const converted =
      tx.type === 'transfer'
        ? convertToGlobal(tx.amount, srcCurrency)
        : getTransactionGlobalAmount(tx, srcCurrency, convertToGlobal, ctx.globalCurrency);

    const categoryOrRoute =
      tx.type === 'transfer'
        ? `${src?.name ?? labels.unknownLabel} → ${dst?.name ?? labels.unknownLabel}`
        : cat?.name ?? tx.category ?? labels.unknownLabel;

    const accountsText =
      tx.type === 'transfer'
        ? `${src?.name ?? labels.unknownLabel} → ${dst?.name ?? labels.unknownLabel}`
        : `${src?.name ?? labels.unknownLabel} (${srcCurrency})`;

    const amountDisplay =
      tx.type === 'transfer' && dst && src && dst.currency !== src.currency
        ? `${formatCurrencyAmount(tx.amount, src.currency)} → ${formatCurrencyAmount(tx.toAmount ?? tx.amount, dst.currency)}`
        : formatCurrencyAmount(tx.type === 'expense' ? -tx.amount : tx.amount, srcCurrency);

    return [
      tx.date,
      labels.typeLabels[tx.type],
      categoryOrRoute,
      accountsText,
      tx.description ?? '—',
      amountDisplay,
      formatCurrencyAmount(converted, ctx.globalCurrency),
    ];
  });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(26, 26, 28);
  doc.rect(0, 0, pageWidth, 118, 'F');

  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.rect(0, 0, pageWidth, 4, 'F');

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

  doc.setFontSize(9);
  doc.setTextColor(184, 184, 190);
  doc.text(`${labels.netCashFlow} (${ctx.globalCurrency})`, pageWidth - 40, 44, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.text(formatCurrencyAmount(summary.netCashFlow, ctx.globalCurrency), pageWidth - 40, 68, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(210, 210, 216);
  doc.text(
    `${labels.totalIncome}: ${formatCurrencyAmount(summary.totalIncome, ctx.globalCurrency)}   |   ${labels.totalExpenses}: ${formatCurrencyAmount(summary.totalExpenses, ctx.globalCurrency)}`,
    pageWidth - 40,
    90,
    { align: 'right' }
  );

  autoTable(doc, {
    startY: 138,
    margin: { left: 40, right: 40, bottom: 56 },
    head: [
      [
        labels.colDate,
        labels.colType,
        labels.colCategoryOrRoute,
        labels.colAccounts,
        labels.colDescription,
        labels.colAmount,
        `${labels.colConverted} (${ctx.globalCurrency})`,
      ],
    ],
    body: bodyRows,
    foot: [
      [
        labels.netCashFlow,
        '',
        '',
        '',
        `${labels.totalIncome}: ${formatCurrencyAmount(summary.totalIncome, ctx.globalCurrency)} | ${labels.totalExpenses}: ${formatCurrencyAmount(summary.totalExpenses, ctx.globalCurrency)}`,
        '',
        formatCurrencyAmount(summary.netCashFlow, ctx.globalCurrency),
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 6,
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
      fontSize: 9,
    },
    columnStyles: {
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: () => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(130, 130, 138);
      doc.text(`${labels.poweredBy} SIMPORA`, 40, pageHeight - 24);
      doc.text(dateStamp, pageWidth - 40, pageHeight - 24, { align: 'right' });
    },
  });

  doc.save(`growy-transactions-${dateStamp}.pdf`);
}

