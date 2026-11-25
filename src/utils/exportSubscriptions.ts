import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Account, BillingFrequency, Subscription, TransactionType } from '../types/finance';
import { formatCurrencyAmount } from './accountMetrics';
import { formatDateYYYYMMDD } from './localeDetection';
import { calculateMonthlyEquivalent, calculateSubscriptionSummary } from './subscriptionMetrics';

export interface ExportSubscriptionsLabels {
  reportTitle: string;
  accountHolder: string;
  generatedDate: string;
  globalCurrency: string;
  appliedFilters: string;
  colName: string;
  colType: string;
  colFrequency: string;
  colAccount: string;
  colNextBilling: string;
  colNativeAmount: string;
  colMonthlyGlobal: string;
  colStatus: string;
  statusActive: string;
  statusPaused: string;
  totalIncome: string;
  totalExpenses: string;
  netMonthlyFlow: string;
  poweredBy: string;
  unknownAccount: string;
  frequencyLabels: Record<BillingFrequency, string>;
  typeLabels: Record<TransactionType, string>;
}

export interface ExportSubscriptionsContext {
  accounts: Account[];
  accountHolder: string;
  globalCurrency: string;
  accentColor: string;
  appliedFiltersText: string;
  timezone?: string;
  convertBetween: (amount: number, fromCurrency: string, toCurrency?: string) => number;
  labels: ExportSubscriptionsLabels;
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

export function exportSubscriptionsToExcel(
  subscriptions: Subscription[],
  ctx: ExportSubscriptionsContext
): void {
  const dateStamp = formatDateYYYYMMDD(new Date(), ctx.timezone);
  const { labels } = ctx;
  const accountMap = new Map(ctx.accounts.map((a) => [a.id, a]));
  const convertToGlobal = (amount: number, from: string) =>
    ctx.convertBetween(amount, from, ctx.globalCurrency);
  const summary = calculateSubscriptionSummary(
    subscriptions,
    ctx.accounts,
    convertToGlobal,
    ctx.timezone
  );

  const rows = subscriptions.map((sub) => {
    const kind: TransactionType = sub.kind ?? 'expense';
    const src = accountMap.get(sub.accountId);
    const dst = sub.toAccountId ? accountMap.get(sub.toAccountId) : undefined;
    const currency = src?.currency ?? 'USD';
    const monthlyGlobal = convertToGlobal(
      calculateMonthlyEquivalent(sub.amount, sub.frequency),
      currency
    );

    const accountText =
      kind === 'transfer'
        ? `${src?.name ?? labels.unknownAccount} (${currency}) → ${dst?.name ?? labels.unknownAccount} (${dst?.currency ?? currency})`
        : src
          ? `${src.name} (${src.currency})`
          : labels.unknownAccount;

    const amountText =
      kind === 'transfer' && dst && src && dst.currency !== src.currency
        ? `${formatCurrencyAmount(sub.amount, src.currency)} → ${formatCurrencyAmount(sub.toAmount ?? sub.amount, dst.currency)}`
        : formatCurrencyAmount(sub.amount, currency);

    return [
      sub.name,
      labels.typeLabels[kind],
      labels.frequencyLabels[sub.frequency],
      accountText,
      sub.nextBillingDate,
      amountText,
      kind === 'transfer' ? '—' : Number(monthlyGlobal.toFixed(2)),
      sub.isActive ? labels.statusActive : labels.statusPaused,
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
      labels.colName,
      labels.colType,
      labels.colFrequency,
      labels.colAccount,
      labels.colNextBilling,
      labels.colNativeAmount,
      `${labels.colMonthlyGlobal} (${ctx.globalCurrency})`,
      labels.colStatus,
    ],
    ...rows,
    [],
    [labels.totalIncome, '', '', '', '', '', Number(summary.monthlyRecurringIncome.toFixed(2)), ''],
    [labels.totalExpenses, '', '', '', '', '', Number(summary.monthlyRecurringExpenses.toFixed(2)), ''],
    [labels.netMonthlyFlow, '', '', '', '', '', Number(summary.netMonthlyRecurringFlow.toFixed(2)), ''],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = Array.from({ length: 8 }, (_, colIdx) => {
    let maxLen = 12;
    for (const row of sheetData) {
      const cell = row[colIdx];
      if (cell !== undefined && cell !== null) {
        maxLen = Math.max(maxLen, String(cell).length + 3);
      }
    }
    return { wch: Math.min(maxLen, 36) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Growy Recurring');
  XLSX.writeFile(workbook, `growy-recurring-${dateStamp}.xlsx`);
}

export function exportSubscriptionsToPDF(
  subscriptions: Subscription[],
  ctx: ExportSubscriptionsContext
): void {
  const dateStamp = formatDateYYYYMMDD(new Date(), ctx.timezone);
  const { labels } = ctx;
  const accentRgb = hexToRgb(ctx.accentColor);
  const accountMap = new Map(ctx.accounts.map((a) => [a.id, a]));
  const convertToGlobal = (amount: number, from: string) =>
    ctx.convertBetween(amount, from, ctx.globalCurrency);
  const summary = calculateSubscriptionSummary(
    subscriptions,
    ctx.accounts,
    convertToGlobal,
    ctx.timezone
  );

  const bodyRows = subscriptions.map((sub) => {
    const kind: TransactionType = sub.kind ?? 'expense';
    const src = accountMap.get(sub.accountId);
    const dst = sub.toAccountId ? accountMap.get(sub.toAccountId) : undefined;
    const currency = src?.currency ?? 'USD';
    const monthlyGlobal = convertToGlobal(
      calculateMonthlyEquivalent(sub.amount, sub.frequency),
      currency
    );

    const accountText =
      kind === 'transfer'
        ? `${src?.name ?? labels.unknownAccount} → ${dst?.name ?? labels.unknownAccount}`
        : src
          ? `${src.name} (${src.currency})`
          : labels.unknownAccount;

    const amountText =
      kind === 'transfer' && dst && src && dst.currency !== src.currency
        ? `${formatCurrencyAmount(sub.amount, src.currency)} → ${formatCurrencyAmount(sub.toAmount ?? sub.amount, dst.currency)}`
        : formatCurrencyAmount(sub.amount, currency);

    return [
      sub.name,
      labels.typeLabels[kind],
      labels.frequencyLabels[sub.frequency],
      accountText,
      sub.nextBillingDate,
      amountText,
      kind === 'transfer' ? '—' : formatCurrencyAmount(monthlyGlobal, ctx.globalCurrency),
      sub.isActive ? labels.statusActive : labels.statusPaused,
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
        labels.colName,
        labels.colType,
        labels.colFrequency,
        labels.colAccount,
        labels.colNextBilling,
        labels.colNativeAmount,
        `${labels.colMonthlyGlobal} (${ctx.globalCurrency})`,
        labels.colStatus,
      ],
    ],
    body: bodyRows,
    foot: [
      [
        labels.totalIncome,
        '',
        '',
        '',
        '',
        '',
        formatCurrencyAmount(summary.monthlyRecurringIncome, ctx.globalCurrency),
        '',
      ],
      [
        labels.totalExpenses,
        '',
        '',
        '',
        '',
        '',
        formatCurrencyAmount(summary.monthlyRecurringExpenses, ctx.globalCurrency),
        '',
      ],
      [
        labels.netMonthlyFlow,
        '',
        '',
        '',
        '',
        '',
        formatCurrencyAmount(summary.netMonthlyRecurringFlow, ctx.globalCurrency),
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

  doc.save(`growy-recurring-${dateStamp}.pdf`);
}
