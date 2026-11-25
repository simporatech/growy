import { UserProfile } from '../context/AuthContext';
import { formatCurrencyAmount, calculateAccountBalance } from './accountMetrics';
import {
  calculateCategoryMetrics,
  calculateGlobalBudgetSummary,
  isTransactionInCurrentMonth,
} from './budgetMetrics';
import {
  calculateLoanSummary,
  getDaysUntilLoanDue,
  getLoanRemaining,
  isLoanOverdue,
  isLoanSettled,
} from './loanMetrics';
import {
  calculateMonthlyEquivalent,
  calculateSubscriptionSummary,
  getSubscriptionBillingStatus,
} from './subscriptionMetrics';
import {
  calculateTransactionSummary,
  getTransactionGlobalAmount,
} from './transactionMetrics';

export type IntelligenceIntentId =
  | 'health_check'
  | 'net_worth'
  | 'spending_breakdown'
  | 'daily_burn'
  | 'biggest_expense'
  | 'income_sources'
  | 'recurring_impact'
  | 'loans_overview'
  | 'debt_payoff_speed'
  | 'currency_distribution'
  | 'savings_projection'
  | 'month_comparison'
  | 'upcoming_bills'
  | 'action_plan';

export type IntelligenceTopicId = 'all' | 'cash_spending' | 'budgets_goals' | 'recurring_loans';

export type IntelligenceTargetView =
  | 'accounts'
  | 'transactions'
  | 'budgets'
  | 'recurring'
  | 'loans';

export interface IntelligenceHighlight {
  label: string;
  value: string;
  tone: 'accent' | 'coral' | 'neutral';
}

export interface IntelligenceActionLink {
  label: string;
  targetTab: IntelligenceTargetView;
}

export interface IntelligenceResponse {
  intentId: IntelligenceIntentId;
  answerText: string;
  highlights: IntelligenceHighlight[];
  actionLink?: IntelligenceActionLink;
  followUpIds: IntelligenceIntentId[];
  healthScore?: number;
}

export interface IntelligencePrompt {
  id: IntelligenceIntentId;
  label: string;
  topic: Exclude<IntelligenceTopicId, 'all'>;
}

export const INTELLIGENCE_PROMPT_IDS: IntelligenceIntentId[] = [
  'health_check',
  'net_worth',
  'spending_breakdown',
  'daily_burn',
  'biggest_expense',
  'income_sources',
  'recurring_impact',
  'loans_overview',
  'debt_payoff_speed',
  'currency_distribution',
  'savings_projection',
  'month_comparison',
  'upcoming_bills',
  'action_plan',
];

const PROMPT_TOPICS: Record<IntelligenceIntentId, Exclude<IntelligenceTopicId, 'all'>> = {
  health_check: 'cash_spending',
  net_worth: 'cash_spending',
  spending_breakdown: 'cash_spending',
  daily_burn: 'cash_spending',
  biggest_expense: 'cash_spending',
  currency_distribution: 'cash_spending',
  month_comparison: 'cash_spending',
  income_sources: 'budgets_goals',
  savings_projection: 'budgets_goals',
  action_plan: 'budgets_goals',
  recurring_impact: 'recurring_loans',
  upcoming_bills: 'recurring_loans',
  loans_overview: 'recurring_loans',
  debt_payoff_speed: 'recurring_loans',
};

const PROMPT_LABELS: Record<'en' | 'es', Record<IntelligenceIntentId, string>> = {
  en: {
    health_check: 'How is my financial health right now?',
    net_worth: 'What is my true net worth?',
    spending_breakdown: 'Where is most of my money going?',
    daily_burn: 'What is my daily spending pace & safe daily allowance?',
    biggest_expense: 'What was my biggest expense & spending pattern?',
    income_sources: 'Where is my income coming from & how close am I to my goals?',
    recurring_impact: 'How much do my recurring payments cost me?',
    loans_overview: 'What is the status of my loans?',
    debt_payoff_speed: 'How fast could I pay off my debts?',
    currency_distribution: 'How is my money distributed across accounts & currencies?',
    savings_projection: 'How much could I save in 3 and 6 months?',
    month_comparison: 'How does this month compare to last month?',
    upcoming_bills: 'What payments or collections are coming up soon?',
    action_plan: 'Give me 3 concrete tips to improve my finances',
  },
  es: {
    health_check: '¿Cómo está mi salud financiera hoy?',
    net_worth: '¿Cuál es mi patrimonio neto real?',
    spending_breakdown: '¿En qué se me está yendo más dinero?',
    daily_burn: '¿Cuánto gasto al día y cuánto puedo gastar hoy?',
    biggest_expense: '¿Cuál fue mi gasto más fuerte y cómo gasto?',
    income_sources: '¿De dónde vienen mis ingresos y cómo van mis metas?',
    recurring_impact: '¿Cuánto me cuestan mis pagos recurrentes?',
    loans_overview: '¿Cómo van mis préstamos y cuentas por cobrar?',
    debt_payoff_speed: '¿En cuánto tiempo podría liquidar mis deudas?',
    currency_distribution: '¿Cómo está repartido mi dinero por cuenta y divisa?',
    savings_projection: '¿Cuánto podría ahorrar en 3 y 6 meses?',
    month_comparison: '¿Cómo va este mes comparado con el mes pasado?',
    upcoming_bills: '¿Qué cobros o vencimientos tengo próximos?',
    action_plan: 'Dame 3 consejos concretos para mejorar mis finanzas',
  },
};

export function getIntelligencePrompts(language: 'en' | 'es'): IntelligencePrompt[] {
  const dict = PROMPT_LABELS[language];
  return INTELLIGENCE_PROMPT_IDS.map((id) => ({
    id,
    label: dict[id],
    topic: PROMPT_TOPICS[id],
  }));
}

export function getIntelligencePromptLabel(
  id: IntelligenceIntentId,
  language: 'en' | 'es'
): string {
  return PROMPT_LABELS[language][id];
}

export function generateIntelligenceWelcome(
  user: UserProfile,
  language: 'en' | 'es'
): { greeting: string; starterIds: IntelligenceIntentId[] } {
  const firstName = user.fullName.trim().split(/\s+/)[0] || 'Growy';
  const accountCount = user.data.accounts.length;
  const txCount = user.data.transactions.length;
  const loanCount = (user.data.loans ?? []).length;

  if (accountCount === 0 && txCount === 0) {
    return {
      greeting:
        language === 'es'
          ? `Hola ${firstName}, soy Growy Intelligence. Aún no tienes cuentas ni movimientos registrados, pero estoy listo para analizar tus finanzas en tiempo real en cuanto empieces.\n\nElige una pregunta abajo para explorar cómo te puedo ayudar:`
          : `Hi ${firstName}, I'm Growy Intelligence. You haven't added any accounts or transactions yet, but I'm ready to analyze your finances in real time as soon as you start.\n\nPick a question below to see how I can help:`,
      starterIds: ['action_plan', 'health_check', 'currency_distribution'],
    };
  }

  const loanPhraseEs = loanCount > 0 ? ` y ${loanCount} préstamo${loanCount === 1 ? '' : 's'}` : '';
  const loanPhraseEn = loanCount > 0 ? `, and ${loanCount} loan${loanCount === 1 ? '' : 's'}` : '';

  return {
    greeting:
      language === 'es'
        ? `Hola ${firstName}. Tengo a la vista tus ${accountCount} cuenta${accountCount === 1 ? '' : 's'}, ${txCount} movimiento${txCount === 1 ? '' : 's'}${loanPhraseEs} para darte respuestas claras con tus números reales.\n\n¿Qué te gustaría revisar primero?`
        : `Hi ${firstName}. I'm looking at your ${accountCount} account${accountCount === 1 ? '' : 's'}, ${txCount} transaction${txCount === 1 ? '' : 's'}${loanPhraseEn} to give you clear answers from your live numbers.\n\nWhat would you like to check first?`,
    starterIds: ['health_check', 'spending_breakdown', 'upcoming_bills'],
  };
}

export function analyzeFinancialIntent(
  intentId: IntelligenceIntentId,
  user: UserProfile,
  convertToGlobal: (amount: number, fromCurrency: string) => number,
  globalCurrency: string,
  language: 'en' | 'es'
): IntelligenceResponse {
  const isEs = language === 'es';
  const fmt = (amount: number, cur = globalCurrency) => formatCurrencyAmount(amount, cur);
  const now = new Date();
  const tz = user.preferences.timezone;

  const accounts = user.data.accounts;
  const transactions = user.data.transactions;
  const categories = user.data.budgets;
  const subscriptions = user.data.subscriptions ?? [];
  const loans = user.data.loans ?? [];

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // Live account balances
  const accountBalances = accounts.map((acc) => {
    const nativeBalance = calculateAccountBalance(acc, transactions);
    const globalBalance = convertToGlobal(nativeBalance, acc.currency);
    return { acc, nativeBalance, globalBalance };
  });
  const totalLiquid = accountBalances.reduce((s, item) => s + item.globalBalance, 0);

  // Current month & all-time transaction summaries
  const monthTxs = transactions.filter((tx) => isTransactionInCurrentMonth(tx.date, now, tz));
  const monthSummary = calculateTransactionSummary(
    monthTxs,
    accounts,
    convertToGlobal,
    globalCurrency
  );
  const allTxSummary = calculateTransactionSummary(
    transactions,
    accounts,
    convertToGlobal,
    globalCurrency
  );

  // Budgets
  const budgetSummary = calculateGlobalBudgetSummary(
    categories,
    transactions,
    accounts,
    convertToGlobal,
    now,
    globalCurrency
  );

  // Recurring
  const subSummary = calculateSubscriptionSummary(subscriptions, accounts, convertToGlobal, tz);

  // Loans
  const loanSummary = calculateLoanSummary(loans, convertToGlobal);

  // Top expense categories this month
  const expenseCategories = categories.filter((c) => c.kind === 'expense');
  const categorySpendingMap = new Map<
    string,
    { id?: string; name: string; spent: number; limit: number; pct: number }
  >();

  for (const cat of expenseCategories) {
    const metrics = calculateCategoryMetrics(
      cat,
      transactions,
      accounts,
      convertToGlobal,
      now,
      globalCurrency
    );
    categorySpendingMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      spent: metrics.actual,
      limit: metrics.target,
      pct: metrics.progressPct,
    });
  }

  for (const tx of monthTxs) {
    if (tx.excludeFromCashFlow || tx.type !== 'expense') continue;
    if (tx.categoryId && categorySpendingMap.has(tx.categoryId)) continue;
    const srcCurrency = accountMap.get(tx.accountId)?.currency ?? globalCurrency;
    const amt = getTransactionGlobalAmount(tx, srcCurrency, convertToGlobal, globalCurrency);
    const key = tx.category?.trim() || (isEs ? 'Sin categoría' : 'Uncategorized');
    const prev = categorySpendingMap.get(`raw:${key}`) ?? {
      name: key,
      spent: 0,
      limit: 0,
      pct: 0,
    };
    prev.spent += amt;
    categorySpendingMap.set(`raw:${key}`, prev);
  }

  const rankedSpending = Array.from(categorySpendingMap.values())
    .filter((item) => item.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  // Upcoming 7-day recurring commitments
  let upcoming7dExpenses = 0;
  let upcoming7dIncome = 0;
  const upcomingEvents: Array<{
    date: string;
    days: number;
    title: string;
    amountGlobal: number;
    kind: 'recurring_expense' | 'recurring_income' | 'recurring_transfer' | 'loan_payable' | 'loan_receivable';
    nativeFormatted: string;
  }> = [];

  for (const sub of subscriptions) {
    if (!sub.isActive) continue;
    const status = getSubscriptionBillingStatus(sub, tz);
    const srcCurrency = accountMap.get(sub.accountId)?.currency ?? globalCurrency;
    const globalAmt = convertToGlobal(sub.amount, srcCurrency);
    const kind = sub.kind ?? 'expense';

    if (status.daysRemaining <= 7) {
      if (kind === 'expense') upcoming7dExpenses += globalAmt;
      else if (kind === 'income') upcoming7dIncome += globalAmt;
    }

    if (status.daysRemaining <= 14) {
      upcomingEvents.push({
        date: sub.nextBillingDate,
        days: status.daysRemaining,
        title: sub.name,
        amountGlobal: globalAmt,
        kind:
          kind === 'income'
            ? 'recurring_income'
            : kind === 'transfer'
              ? 'recurring_transfer'
              : 'recurring_expense',
        nativeFormatted: fmt(sub.amount, srcCurrency),
      });
    }
  }

  for (const loan of loans) {
    if (isLoanSettled(loan)) continue;
    const days = getDaysUntilLoanDue(loan.dueDate, tz);
    if (days <= 14) {
      const remaining = getLoanRemaining(loan);
      upcomingEvents.push({
        date: loan.dueDate,
        days,
        title: loan.title,
        amountGlobal: convertToGlobal(remaining, loan.currency),
        kind: loan.direction === 'payable' ? 'loan_payable' : 'loan_receivable',
        nativeFormatted: fmt(remaining, loan.currency),
      });
    }
  }

  upcomingEvents.sort((a, b) => a.days - b.days);

  // Empty state guard for analytical intents
  if (accounts.length === 0 && transactions.length === 0 && intentId !== 'action_plan') {
    return {
      intentId,
      answerText: isEs
        ? 'Todavía no tengo cuentas o movimientos para calcular este análisis. En cuanto crees tu primera cuenta y registres tus ingresos o gastos, aquí verás tus métricas reales al instante.'
        : "I don't have any accounts or transactions to analyze yet. Once you create your first account and record a few movements, I'll show your real numbers right here.",
      highlights: [
        { label: isEs ? 'Cuentas activas' : 'Active Accounts', value: '0', tone: 'neutral' },
        { label: isEs ? 'Movimientos' : 'Movements', value: '0', tone: 'neutral' },
      ],
      actionLink: {
        label: isEs ? 'Crear primera cuenta' : 'Create First Account',
        targetTab: 'accounts',
      },
      followUpIds: ['action_plan', 'currency_distribution', 'health_check'],
    };
  }

  switch (intentId) {
    case 'health_check': {
      const savingsRate =
        monthSummary.totalIncome > 0
          ? ((monthSummary.totalIncome - monthSummary.totalExpenses) / monthSummary.totalIncome) * 100
          : monthSummary.totalExpenses > 0
            ? -100
            : 0;

      // Deterministic 0-100 score
      let score = 55;
      if (totalLiquid > 0) score += 10;
      if (monthSummary.netCashFlow > 0) score += 15;
      else if (monthSummary.netCashFlow < 0) score -= 12;
      if (savingsRate >= 20) score += 10;
      else if (savingsRate >= 10) score += 5;
      if (budgetSummary.totalExpenseBudgeted > 0) {
        if (budgetSummary.globalExpensePct <= 85) score += 10;
        else if (budgetSummary.globalExpensePct > 100) score -= 10;
      }
      if (loanSummary.netLoanPosition < 0 && totalLiquid > 0) {
        const debtRatio = Math.abs(loanSummary.netLoanPosition) / totalLiquid;
        if (debtRatio > 1) score -= 10;
      }
      score = Math.max(15, Math.min(98, Math.round(score)));

      const toneDesc = isEs
        ? score >= 75
          ? 'Tu salud financiera está en muy buen estado.'
          : score >= 55
            ? 'Vas por buen camino, con algunos puntos fáciles de fortalecer.'
            : 'Hay presión en tu balance este mes, pero puedes corregirlo con ajustes puntuales.'
        : score >= 75
          ? 'Your financial health is in great shape.'
          : score >= 55
            ? 'You are on solid ground, with a few easy areas to strengthen.'
            : 'Your monthly balance is under some pressure, but a few focused adjustments can turn it around.';

      const budgetLine =
        budgetSummary.totalExpenseBudgeted > 0
          ? isEs
            ? `Llevas usado el ${Math.round(budgetSummary.globalExpensePct)}% de tu presupuesto mensual de gastos.`
            : `You've used ${Math.round(budgetSummary.globalExpensePct)}% of your monthly expense budget.`
          : isEs
            ? 'Aún no defines límites de presupuesto para tus gastos.'
            : "You haven't set monthly expense budgets yet.";

      const loanLine =
        loans.length > 0
          ? isEs
            ? ` Tu balance de préstamos es de ${fmt(loanSummary.netLoanPosition)}.`
            : ` Your loan balance stands at ${fmt(loanSummary.netLoanPosition)}.`
          : '';

      return {
        intentId,
        healthScore: score,
        answerText: isEs
          ? `${toneDesc}\n\nActualmente cuentas con ${fmt(totalLiquid)} en tus cuentas y un balance neto de ${fmt(monthSummary.netCashFlow)} en lo que va del mes (tasa de ahorro del ${Math.round(savingsRate)}%). ${budgetLine}${loanLine}`
          : `${toneDesc}\n\nYou currently hold ${fmt(totalLiquid)} across your accounts with a net balance of ${fmt(monthSummary.netCashFlow)} so far this month (${Math.round(savingsRate)}% savings rate). ${budgetLine}${loanLine}`,
        highlights: [
          {
            label: isEs ? 'Dinero disponible' : 'Available Cash',
            value: fmt(totalLiquid),
            tone: totalLiquid >= 0 ? 'accent' : 'coral',
          },
          {
            label: isEs ? 'Balance del mes' : 'Monthly Net Balance',
            value: fmt(monthSummary.netCashFlow),
            tone: monthSummary.netCashFlow >= 0 ? 'accent' : 'coral',
          },
          {
            label: isEs ? 'Balance de préstamos' : 'Loan Balance',
            value: fmt(loanSummary.netLoanPosition),
            tone: loanSummary.netLoanPosition >= 0 ? 'neutral' : 'coral',
          },
        ],
        actionLink: {
          label: isEs ? 'Revisar cuentas' : 'Review Accounts',
          targetTab: 'accounts',
        },
        followUpIds: ['spending_breakdown', 'savings_projection', 'action_plan'],
      };
    }

    case 'spending_breakdown': {
      if (rankedSpending.length === 0) {
        return {
          intentId,
          answerText: isEs
            ? 'No tienes gastos registrados este mes todavía. Cuando registres tus compras o pagos recurrentes, aquí te mostraré exactamente en qué categorías se concentra tu dinero.'
            : "You don't have any expenses recorded this month yet. Once you log purchases or recurring payments, I'll show you exactly where your money is going.",
          highlights: [
            { label: isEs ? 'Gastos del mes' : 'Monthly Expenses', value: fmt(0), tone: 'neutral' },
          ],
          actionLink: {
            label: isEs ? 'Ver movimientos' : 'View Transactions',
            targetTab: 'transactions',
          },
          followUpIds: ['recurring_impact', 'health_check', 'action_plan'],
        };
      }

      const top3 = rankedSpending.slice(0, 3);
      const flagged = rankedSpending.filter((c) => c.limit > 0 && c.pct >= 80);
      const totalSpent = monthSummary.totalExpenses || top3.reduce((s, c) => s + c.spent, 0);

      const lines = top3.map((c, idx) => {
        const share = totalSpent > 0 ? Math.round((c.spent / totalSpent) * 100) : 0;
        const limitPart =
          c.limit > 0
            ? isEs
              ? ` (${Math.round(c.pct)}% de su límite)`
              : ` (${Math.round(c.pct)}% of its limit)`
            : '';
        return `${idx + 1}. ${c.name}: ${fmt(c.spent)} · ${share}%${limitPart}`;
      });

      const alertLine =
        flagged.length > 0
          ? isEs
            ? `\n\nAtención: ${flagged.map((f) => `${f.name} (${Math.round(f.pct)}%)`).join(', ')} ya superó el 80% de su límite mensual.`
            : `\n\nHeads up: ${flagged.map((f) => `${f.name} (${Math.round(f.pct)}%)`).join(', ')} has already crossed 80% of its monthly limit.`
          : '';

      return {
        intentId,
        answerText: isEs
          ? `Este mes has gastado ${fmt(monthSummary.totalExpenses)}. Tus categorías principales son:\n\n${lines.join('\n')}${alertLine}`
          : `This month you've spent ${fmt(monthSummary.totalExpenses)}. Your top categories are:\n\n${lines.join('\n')}${alertLine}`,
        highlights: top3.map((c) => ({
          label: c.name,
          value: fmt(c.spent),
          tone: c.limit > 0 && c.pct >= 100 ? 'coral' : 'neutral',
        })),
        actionLink: {
          label: isEs ? 'Abrir Presupuestos' : 'Open Budgets',
          targetTab: 'budgets',
        },
        followUpIds: ['recurring_impact', 'action_plan', 'health_check'],
      };
    }

    case 'recurring_impact': {
      const safeToSpend = totalLiquid - upcoming7dExpenses;
      if (subSummary.activeCount === 0) {
        return {
          intentId,
          answerText: isEs
            ? 'No tienes pagos o ingresos recurrentes activos en este momento. Si tienes suscripciones, renta o salario fijo, agregarlos te ayudará a anticipar tu flujo del mes.'
            : "You don't have any active recurring rules right now. Adding fixed subscriptions, rent, or salary helps me forecast your safe-to-spend balance.",
          highlights: [
            { label: isEs ? 'Reglas activas' : 'Active Rules', value: '0', tone: 'neutral' },
            { label: isEs ? 'Dinero disponible' : 'Available Cash', value: fmt(totalLiquid), tone: 'accent' },
          ],
          actionLink: {
            label: isEs ? 'Configurar recurrentes' : 'Set Up Recurring',
            targetTab: 'recurring',
          },
          followUpIds: ['upcoming_bills', 'savings_projection', 'health_check'],
        };
      }

      return {
        intentId,
        answerText: isEs
          ? `Tienes ${subSummary.activeCount} movimiento${subSummary.activeCount === 1 ? '' : 's'} recurrente${subSummary.activeCount === 1 ? '' : 's'} activo${subSummary.activeCount === 1 ? '' : 's'}. En promedio representan ${fmt(subSummary.monthlyRecurringExpenses)} en gastos al mes y ${fmt(subSummary.monthlyRecurringIncome)} en ingresos.\n\nEn los próximos 7 días vencen ${fmt(upcoming7dExpenses)} en pagos, dejando un saldo realmente libre ("seguro para gastar") de ${fmt(safeToSpend)}.`
          : `You have ${subSummary.activeCount} active recurring rule${subSummary.activeCount === 1 ? '' : 's'}. On a monthly basis, they total ${fmt(subSummary.monthlyRecurringExpenses)} in expenses and ${fmt(subSummary.monthlyRecurringIncome)} in income.\n\nOver the next 7 days, ${fmt(upcoming7dExpenses)} in payments are due, leaving ${fmt(safeToSpend)} in true safe-to-spend cash.`,
        highlights: [
          {
            label: isEs ? 'Gastos fijos / mes' : 'Recurring Expenses / mo',
            value: fmt(subSummary.monthlyRecurringExpenses),
            tone: 'coral',
          },
          {
            label: isEs ? 'Próximos 7 días' : 'Due Next 7 Days',
            value: fmt(upcoming7dExpenses),
            tone: upcoming7dExpenses > 0 ? 'neutral' : 'accent',
          },
          {
            label: isEs ? 'Seguro para gastar' : 'Safe to Spend',
            value: fmt(safeToSpend),
            tone: safeToSpend >= 0 ? 'accent' : 'coral',
          },
        ],
        actionLink: {
          label: isEs ? 'Ver Recurrentes' : 'View Recurring',
          targetTab: 'recurring',
        },
        followUpIds: ['upcoming_bills', 'spending_breakdown', 'savings_projection'],
      };
    }

    case 'loans_overview': {
      if (loans.length === 0) {
        return {
          intentId,
          answerText: isEs
            ? 'No tienes préstamos ni dinero pendiente por cobrar registrado. Cuando quieras llevar control de deudas o pagos que te deben, puedes crearlos en la sección de Préstamos.'
            : "You don't have any loans or money owed to you recorded yet. Whenever you want to track debts or money lent out, you can add them in Loans.",
          highlights: [
            { label: isEs ? 'Balance de préstamos' : 'Loan Balance', value: fmt(0), tone: 'neutral' },
          ],
          actionLink: {
            label: isEs ? 'Ir a Préstamos' : 'Go to Loans',
            targetTab: 'loans',
          },
          followUpIds: ['health_check', 'upcoming_bills', 'action_plan'],
        };
      }

      const activeLoans = loans.filter((l) => !isLoanSettled(l));
      const overdueLoans = activeLoans.filter((l) => isLoanOverdue(l, tz));
      const nearest = [...activeLoans].sort(
        (a, b) => getDaysUntilLoanDue(a.dueDate, tz) - getDaysUntilLoanDue(b.dueDate, tz)
      )[0];

      const nearestNote = nearest
        ? isEs
          ? ` El vencimiento más próximo es "${nearest.title}" (${fmt(getLoanRemaining(nearest), nearest.currency)}, fecha límite ${nearest.dueDate}).`
          : ` Your nearest due date is "${nearest.title}" (${fmt(getLoanRemaining(nearest), nearest.currency)}, due ${nearest.dueDate}).`
        : '';

      const overdueNote =
        overdueLoans.length > 0
          ? isEs
            ? `\n\nTienes ${overdueLoans.length} préstamo${overdueLoans.length === 1 ? '' : 's'} con fecha vencida.`
            : `\n\nYou have ${overdueLoans.length} overdue loan${overdueLoans.length === 1 ? '' : 's'}.`
          : '';

      return {
        intentId,
        answerText: isEs
          ? `Tienes ${loanSummary.activeCount} préstamo${loanSummary.activeCount === 1 ? '' : 's'} activo${loanSummary.activeCount === 1 ? '' : 's'} y ${loanSummary.settledCount} saldado${loanSummary.settledCount === 1 ? '' : 's'}. En total te deben ${fmt(loanSummary.totalReceivable)} y debes ${fmt(loanSummary.totalPayable)}.${nearestNote}${overdueNote}`
          : `You have ${loanSummary.activeCount} active and ${loanSummary.settledCount} settled loan${loans.length === 1 ? '' : 's'}. Overall, ${fmt(loanSummary.totalReceivable)} is owed to you and you owe ${fmt(loanSummary.totalPayable)}.${nearestNote}${overdueNote}`,
        highlights: [
          {
            label: isEs ? 'Total que me deben' : 'Owed to Me',
            value: fmt(loanSummary.totalReceivable),
            tone: 'accent',
          },
          {
            label: isEs ? 'Total que debo' : 'Money I Owe',
            value: fmt(loanSummary.totalPayable),
            tone: loanSummary.totalPayable > 0 ? 'coral' : 'neutral',
          },
          {
            label: isEs ? 'Balance de préstamos' : 'Loan Balance',
            value: fmt(loanSummary.netLoanPosition),
            tone: loanSummary.netLoanPosition >= 0 ? 'accent' : 'coral',
          },
        ],
        actionLink: {
          label: isEs ? 'Administrar Préstamos' : 'Manage Loans',
          targetTab: 'loans',
        },
        followUpIds: ['upcoming_bills', 'recurring_impact', 'health_check'],
      };
    }

    case 'currency_distribution': {
      const byCurrency = new Map<string, number>();
      for (const item of accountBalances) {
        byCurrency.set(
          item.acc.currency,
          (byCurrency.get(item.acc.currency) ?? 0) + item.globalBalance
        );
      }

      const sortedCurrencies = Array.from(byCurrency.entries()).sort((a, b) => b[1] - a[1]);
      const sortedAccounts = [...accountBalances].sort((a, b) => b.globalBalance - a.globalBalance);

      const curLines = sortedCurrencies.map(([cur, val]) => {
        const pct = totalLiquid > 0 ? Math.round((val / totalLiquid) * 100) : 0;
        return `• ${cur}: ${fmt(val)} (${pct}%)`;
      });

      const topAcc = sortedAccounts[0];
      const topAccText = topAcc
        ? isEs
          ? `\n\nTu cuenta principal es "${topAcc.acc.name}" con ${fmt(topAcc.nativeBalance, topAcc.acc.currency)}. La diferencia cambiaria acumulada en tu historial es de ${fmt(allTxSummary.totalFxVariance)}.`
          : `\n\nYour largest account is "${topAcc.acc.name}" holding ${fmt(topAcc.nativeBalance, topAcc.acc.currency)}. Your historical exchange rate difference is ${fmt(allTxSummary.totalFxVariance)}.`
        : '';

      return {
        intentId,
        answerText: isEs
          ? `Tu dinero total de ${fmt(totalLiquid)} está repartido en ${accounts.length} cuenta${accounts.length === 1 ? '' : 's'}:\n\n${curLines.join('\n')}${topAccText}`
          : `Your ${fmt(totalLiquid)} total portfolio is spread across ${accounts.length} account${accounts.length === 1 ? '' : 's'}:\n\n${curLines.join('\n')}${topAccText}`,
        highlights: [
          ...sortedCurrencies.slice(0, 2).map(([cur, val]) => ({
            label: cur,
            value: fmt(val),
            tone: 'accent' as const,
          })),
          {
            label: isEs ? 'Diferencia cambiaria' : 'Exchange Rate Diff.',
            value: fmt(allTxSummary.totalFxVariance),
            tone: allTxSummary.totalFxVariance >= 0 ? 'neutral' : 'coral',
          },
        ],
        actionLink: {
          label: isEs ? 'Ver Cuentas' : 'View Accounts',
          targetTab: 'accounts',
        },
        followUpIds: ['health_check', 'savings_projection', 'action_plan'],
      };
    }

    case 'savings_projection': {
      const hasMonthActivity = monthSummary.totalIncome > 0 || monthSummary.totalExpenses > 0;
      const monthlyRate = hasMonthActivity
        ? monthSummary.netCashFlow
        : subSummary.netMonthlyRecurringFlow;

      const proj3m = totalLiquid + monthlyRate * 3;
      const proj6m = totalLiquid + monthlyRate * 6;

      const caveat = !hasMonthActivity
        ? isEs
          ? '\n\nNota: Como aún no tienes movimientos este mes, esta proyección se basa únicamente en tus reglas recurrentes activas.'
          : '\n\nNote: Since you have no movements recorded this month yet, this projection is based only on your active recurring rules.'
        : '';

      return {
        intentId,
        answerText: isEs
          ? `Con tu ritmo actual de ${fmt(monthlyRate)} al mes (partiendo de ${fmt(totalLiquid)} disponibles), en 3 meses podrías alcanzar ${fmt(proj3m)} y en 6 meses llegar a ${fmt(proj6m)}.${caveat}`
          : `At your current pace of ${fmt(monthlyRate)} per month (starting from ${fmt(totalLiquid)} available), in 3 months you could reach ${fmt(proj3m)} and in 6 months reach ${fmt(proj6m)}.${caveat}`,
        highlights: [
          {
            label: isEs ? 'Ritmo mensual' : 'Monthly Pace',
            value: fmt(monthlyRate),
            tone: monthlyRate >= 0 ? 'accent' : 'coral',
          },
          {
            label: isEs ? 'En 3 meses' : 'In 3 Months',
            value: fmt(proj3m),
            tone: proj3m >= totalLiquid ? 'accent' : 'coral',
          },
          {
            label: isEs ? 'En 6 meses' : 'In 6 Months',
            value: fmt(proj6m),
            tone: proj6m >= totalLiquid ? 'accent' : 'coral',
          },
        ],
        actionLink: {
          label: isEs ? 'Revisar Recurrentes' : 'Review Recurring',
          targetTab: 'recurring',
        },
        followUpIds: ['recurring_impact', 'spending_breakdown', 'action_plan'],
      };
    }

    case 'upcoming_bills': {
      if (upcomingEvents.length === 0) {
        return {
          intentId,
          answerText: isEs
            ? 'No tienes cobros recurrentes ni vencimientos de préstamos programados para los próximos 14 días. ¡Todo despejado por ahora!'
            : "You don't have any recurring payments or loan due dates scheduled over the next 14 days. Smooth sailing ahead!",
          highlights: [
            { label: isEs ? 'Próximos 14 días' : 'Next 14 Days', value: '0', tone: 'accent' },
          ],
          actionLink: {
            label: isEs ? 'Ver Recurrentes' : 'View Recurring',
            targetTab: 'recurring',
          },
          followUpIds: ['recurring_impact', 'loans_overview', 'health_check'],
        };
      }

      const lines = upcomingEvents.slice(0, 5).map((ev) => {
        const when =
          ev.days < 0
            ? isEs
              ? `Vencido (${Math.abs(ev.days)}d)`
              : `Overdue (${Math.abs(ev.days)}d)`
            : ev.days === 0
              ? isEs
                ? 'Hoy'
                : 'Today'
              : isEs
                ? `En ${ev.days}d (${ev.date})`
                : `In ${ev.days}d (${ev.date})`;
        const sign =
          ev.kind === 'recurring_income' || ev.kind === 'loan_receivable' ? '+' : '−';
        return `• ${when} · ${ev.title}: ${sign}${ev.nativeFormatted}`;
      });

      const dueOutflow = upcomingEvents
        .filter((e) => e.kind === 'recurring_expense' || e.kind === 'loan_payable')
        .reduce((s, e) => s + e.amountGlobal, 0);

      return {
        intentId,
        answerText: isEs
          ? `Estos son tus próximos movimientos y vencimientos en los siguientes 14 días:\n\n${lines.join('\n')}`
          : `Here are your upcoming payments, collections, and due dates over the next 14 days:\n\n${lines.join('\n')}`,
        highlights: [
          {
            label: isEs ? 'Eventos próximos' : 'Upcoming Events',
            value: String(upcomingEvents.length),
            tone: 'neutral',
          },
          {
            label: isEs ? 'Salidas próximas' : 'Upcoming Outflows',
            value: fmt(dueOutflow),
            tone: dueOutflow > 0 ? 'coral' : 'accent',
          },
        ],
        actionLink: {
          label: isEs ? 'Ver Recurrentes' : 'View Recurring',
          targetTab: 'recurring',
        },
        followUpIds: ['recurring_impact', 'loans_overview', 'action_plan'],
      };
    }

    case 'action_plan': {
      const tips: string[] = [];
      const activeSubscriptions = subscriptions.filter((s) => s.isActive);

      if (accounts.length === 0) {
        tips.push(
          isEs
            ? '1. Agrega tu cuenta principal (banco, efectivo o billetera) para ver tu saldo real en tiempo real.'
            : '1. Add your main account (bank, cash, or wallet) to track your live available balance.'
        );
      }

      // Tip #1: Prioritize over-limit (>100%) categories before caution (80%-100%) categories
      const sortedExpenseBudgets = rankedSpending
        .filter((c) => c.limit > 0)
        .sort((a, b) => b.pct - a.pct);
      const exceededBudget = sortedExpenseBudgets.find((c) => c.pct > 100);
      const warningBudget = sortedExpenseBudgets.find((c) => c.pct >= 80 && c.pct <= 100);
      const unbudgetedTop = rankedSpending.find((c) => c.limit === 0);

      if (exceededBudget) {
        const overage = exceededBudget.spent - exceededBudget.limit;
        tips.push(
          isEs
            ? `${tips.length + 1}. "${exceededBudget.name}" ya superó su límite mensual al ${Math.round(exceededBudget.pct)}% (${fmt(overage)} por encima). Frena gastos no esenciales aquí primero.`
            : `${tips.length + 1}. "${exceededBudget.name}" has exceeded its monthly limit at ${Math.round(exceededBudget.pct)}% (${fmt(overage)} over budget). Pause non-essential spending here first.`
        );
      } else if (warningBudget) {
        tips.push(
          isEs
            ? `${tips.length + 1}. Modera "${warningBudget.name}" este mes: ya usaste el ${Math.round(warningBudget.pct)}% de su límite (${fmt(warningBudget.spent)} de ${fmt(warningBudget.limit)}).`
            : `${tips.length + 1}. Slow down on "${warningBudget.name}" this month: you've used ${Math.round(warningBudget.pct)}% of its limit (${fmt(warningBudget.spent)} of ${fmt(warningBudget.limit)}).`
        );
      } else if (unbudgetedTop) {
        tips.push(
          isEs
            ? `${tips.length + 1}. Ponle un presupuesto mensual a "${unbudgetedTop.name}" (tu mayor gasto con ${fmt(unbudgetedTop.spent)}) para mantenerlo bajo control.`
            : `${tips.length + 1}. Set a monthly budget for "${unbudgetedTop.name}" (your top spend at ${fmt(unbudgetedTop.spent)}) to keep it in check.`
        );
      }

      if (subSummary.monthlyRecurringExpenses > 0 && monthSummary.totalIncome > 0) {
        const recRatio = Math.round(
          (subSummary.monthlyRecurringExpenses / monthSummary.totalIncome) * 100
        );
        if (recRatio >= 40) {
          tips.push(
            isEs
              ? `${tips.length + 1}. Tus pagos recurrentes absorben el ${recRatio}% de tus ingresos del mes. Revisa si puedes pausar alguna suscripción poco usada.`
              : `${tips.length + 1}. Your recurring payments take up ${recRatio}% of this month's income. Check if any underused subscription can be paused.`
          );
        }
      }

      const overdueLoan = loans.find((l) => isLoanOverdue(l, tz));
      if (overdueLoan && tips.length < 3) {
        tips.push(
          isEs
            ? `${tips.length + 1}. Atiende el préstamo vencido "${overdueLoan.title}" (${fmt(getLoanRemaining(overdueLoan), overdueLoan.currency)}) para ponerte al día.`
            : `${tips.length + 1}. Follow up on the overdue loan "${overdueLoan.title}" (${fmt(getLoanRemaining(overdueLoan), overdueLoan.currency)}) to bring it current.`
        );
      }

      if (tips.length < 3 && accounts.length > 0 && monthSummary.netCashFlow > 0) {
        const autoSaveTarget = monthSummary.netCashFlow * 0.25;
        tips.push(
          isEs
            ? `${tips.length + 1}. Automatiza un ahorro recurrente de ${fmt(autoSaveTarget)} al mes hacia una cuenta separada aprovechando tu balance positivo.`
            : `${tips.length + 1}. Automate a recurring transfer of ${fmt(autoSaveTarget)} per month into a separate savings account while your balance is positive.`
        );
      }

      while (tips.length < 3) {
        const idx = tips.length + 1;
        if (idx === 1) {
          tips.push(
            isEs
              ? '1. Registra tus gastos diarios por 7 días seguidos para descubrir fugas pequeñas.'
              : '1. Log your daily expenses for 7 days straight to spot small recurring leaks.'
          );
        } else if (idx === 2) {
          tips.push(
            isEs
              ? '2. Crea presupuestos para tus 3 categorías principales (como comida, transporte y hogar).'
              : '2. Create monthly budgets for your top 3 categories (like food, transport, and home).'
          );
        } else if (activeSubscriptions.length === 0) {
          tips.push(
            isEs
              ? '3. Programa tus pagos fijos en Recurrentes para saber exactamente cuánto dinero libre te queda cada semana.'
              : '3. Schedule your fixed bills in Recurring so you always know how much safe-to-spend cash you have each week.'
          );
        } else {
          // Context-aware Tip #3 when user already has active recurring rules
          const activeReceivables = loans
            .filter((l) => l.direction === 'receivable' && !isLoanSettled(l))
            .sort(
              (a, b) =>
                getDaysUntilLoanDue(a.dueDate, tz) - getDaysUntilLoanDue(b.dueDate, tz)
            );
          const activePayables = loans
            .filter((l) => l.direction === 'payable' && !isLoanSettled(l))
            .sort(
              (a, b) =>
                convertToGlobal(getLoanRemaining(b), b.currency) -
                convertToGlobal(getLoanRemaining(a), a.currency)
            );

          if (activeReceivables.length > 0) {
            const target = activeReceivables[0];
            const days = getDaysUntilLoanDue(target.dueDate, tz);
            const dueEn =
              days < 0
                ? `overdue by ${Math.abs(days)}d`
                : days === 0
                  ? 'due today'
                  : days === 1
                    ? 'due tomorrow'
                    : `due in ${days} days`;
            const dueEs =
              days < 0
                ? `vencido hace ${Math.abs(days)}d`
                : days === 0
                  ? 'vence hoy'
                  : days === 1
                    ? 'vence mañana'
                    : `vence en ${days} días`;
            tips.push(
              isEs
                ? `${idx}. Da seguimiento a "${target.title}" (${fmt(getLoanRemaining(target), target.currency)}, ${dueEs}) para sumar ese dinero a tus cuentas.`
                : `${idx}. Follow up on "${target.title}" (${fmt(getLoanRemaining(target), target.currency)}, ${dueEn}) to boost your liquid cash.`
            );
          } else if (activePayables.length > 0) {
            const target = activePayables[0];
            const remStr = fmt(getLoanRemaining(target), target.currency);
            tips.push(
              isEs
                ? monthSummary.netCashFlow > 0
                  ? `${idx}. Destina parte de tu balance mensual positivo a "${target.title}" (${remStr} pendiente) para liquidarlo más rápido.`
                  : `${idx}. Prioriza abonos constantes a "${target.title}" (${remStr} pendiente) para reducir tu deuda.`
                : monthSummary.netCashFlow > 0
                  ? `${idx}. Direct part of your positive monthly net balance toward "${target.title}" (${remStr} remaining) to pay it off faster.`
                  : `${idx}. Prioritize steady payments toward "${target.title}" (${remStr} remaining) to reduce your debt load.`
            );
          } else {
            tips.push(
              isEs
                ? `${idx}. Tus ${activeSubscriptions.length} regla${activeSubscriptions.length === 1 ? '' : 's'} recurrente${activeSubscriptions.length === 1 ? '' : 's'} activa${activeSubscriptions.length === 1 ? '' : 's'} suman ${fmt(subSummary.monthlyRecurringExpenses)}/mes en gastos fijos. Revísalas periódicamente para pausar servicios que ya no uses.`
                : `${idx}. Your ${activeSubscriptions.length} active recurring rule${activeSubscriptions.length === 1 ? '' : 's'} total ${fmt(subSummary.monthlyRecurringExpenses)}/mo in fixed expenses. Review them periodically to pause any unused service.`
            );
          }
        }
      }

      return {
        intentId,
        answerText: isEs
          ? `Aquí tienes 3 pasos concretos basados en tu situación actual:\n\n${tips.join('\n\n')}`
          : `Here are 3 concrete steps tailored to your current numbers:\n\n${tips.join('\n\n')}`,
        highlights: [
          {
            label: isEs ? 'Dinero disponible' : 'Available Cash',
            value: fmt(totalLiquid),
            tone: totalLiquid >= 0 ? 'accent' : 'coral',
          },
          {
            label: isEs ? 'Gastos fijos / mes' : 'Recurring / mo',
            value: fmt(subSummary.monthlyRecurringExpenses),
            tone: 'neutral',
          },
        ],
        actionLink: {
          label: accounts.length === 0
            ? isEs
              ? 'Ir a Cuentas'
              : 'Go to Accounts'
            : isEs
              ? 'Revisar Presupuestos'
              : 'Review Budgets',
          targetTab: accounts.length === 0 ? 'accounts' : 'budgets',
        },
        followUpIds: ['health_check', 'spending_breakdown', 'savings_projection'],
      };
    }

    case 'net_worth': {
      const totalAssets = totalLiquid + loanSummary.totalReceivable;
      const totalLiabilities = loanSummary.totalPayable;
      const trueNetWorth = totalAssets - totalLiabilities;

      return {
        intentId,
        answerText: isEs
          ? `Tu patrimonio neto real es de ${fmt(trueNetWorth)}.\n\nEsto suma ${fmt(totalLiquid)} en tus cuentas más ${fmt(loanSummary.totalReceivable)} que te deben (activos totales: ${fmt(totalAssets)}), menos ${fmt(totalLiabilities)} que debes actualmente.`
          : `Your true net worth is ${fmt(trueNetWorth)}.\n\nThis combines ${fmt(totalLiquid)} across your accounts plus ${fmt(loanSummary.totalReceivable)} owed to you (total assets: ${fmt(totalAssets)}), minus ${fmt(totalLiabilities)} you currently owe.`,
        highlights: [
          {
            label: isEs ? 'Activos totales' : 'Assets',
            value: fmt(totalAssets),
            tone: 'accent',
          },
          {
            label: isEs ? 'Deudas' : 'Liabilities',
            value: fmt(totalLiabilities),
            tone: totalLiabilities > 0 ? 'coral' : 'neutral',
          },
          {
            label: isEs ? 'Patrimonio neto' : 'True Net Worth',
            value: fmt(trueNetWorth),
            tone: trueNetWorth >= 0 ? 'accent' : 'coral',
          },
        ],
        actionLink: {
          label: isEs ? 'Ver Cuentas' : 'View Accounts',
          targetTab: 'accounts',
        },
        followUpIds: ['health_check', 'loans_overview', 'currency_distribution'],
      };
    }

    case 'daily_burn': {
      const elapsedDays = Math.max(1, now.getDate());
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const remainingDays = Math.max(1, daysInMonth - now.getDate());
      const dailyAvg = monthSummary.totalExpenses / elapsedDays;
      const projectedEnd = dailyAvg * daysInMonth;
      const budgetLimit = budgetSummary.totalExpenseBudgeted;
      const safeDaily =
        budgetLimit > 0 ? Math.max(0, (budgetLimit - monthSummary.totalExpenses) / remainingDays) : null;

      const safeText =
        safeDaily !== null
          ? isEs
            ? ` Para terminar dentro de tu presupuesto mensual (${fmt(budgetLimit)}), puedes gastar hasta ${fmt(safeDaily)} al día durante los ${remainingDays} días restantes.`
            : ` To stay within your monthly budget (${fmt(budgetLimit)}), your safe daily allowance is ${fmt(safeDaily)} over the remaining ${remainingDays} days.`
          : isEs
            ? ' Configura presupuestos de gasto para que calcule tu límite diario recomendado.'
            : ' Set monthly expense budgets so I can calculate your safe daily allowance.';

      return {
        intentId,
        answerText: isEs
          ? `En los ${elapsedDays} días que van del mes llevas un ritmo promedio de ${fmt(dailyAvg)} al día. A este paso, cerrarías el mes con ${fmt(projectedEnd)} en gastos.${safeText}`
          : `Over the ${elapsedDays} elapsed days this month, your average spending pace is ${fmt(dailyAvg)} per day. At this rate, you're projected to finish the month at ${fmt(projectedEnd)}.${safeText}`,
        highlights: [
          {
            label: isEs ? 'Promedio diario' : 'Daily Average',
            value: fmt(dailyAvg),
            tone: 'neutral',
          },
          {
            label: isEs ? 'Proyección cierre' : 'Projected Month-End',
            value: fmt(projectedEnd),
            tone: budgetLimit > 0 && projectedEnd > budgetLimit ? 'coral' : 'neutral',
          },
          {
            label: isEs ? 'Límite diario seguro' : 'Safe Daily Limit',
            value: safeDaily !== null ? fmt(safeDaily) : isEs ? 'Sin presupuesto' : 'No budget',
            tone: safeDaily !== null && safeDaily > 0 ? 'accent' : 'coral',
          },
        ],
        actionLink: {
          label: isEs ? 'Ver Movimientos' : 'View Transactions',
          targetTab: 'transactions',
        },
        followUpIds: ['spending_breakdown', 'biggest_expense', 'month_comparison'],
      };
    }

    case 'biggest_expense': {
      const monthExpenses = monthTxs.filter((tx) => !tx.excludeFromCashFlow && tx.type === 'expense');
      if (monthExpenses.length === 0) {
        return {
          intentId,
          answerText: isEs
            ? 'No tienes gastos operativos registrados este mes todavía. Cuando registres compras o pagos, aquí identificaré tu gasto más alto y tu promedio por movimiento.'
            : "You haven't recorded any operational expenses this month yet. Once you log purchases, I'll highlight your largest expense and spending pattern.",
          highlights: [
            { label: isEs ? 'Movimientos' : 'Movements', value: '0', tone: 'neutral' },
          ],
          actionLink: {
            label: isEs ? 'Ver Movimientos' : 'View Transactions',
            targetTab: 'transactions',
          },
          followUpIds: ['daily_burn', 'spending_breakdown', 'action_plan'],
        };
      }

      let largestTx = monthExpenses[0];
      let largestAmt = 0;
      const accountFreq = new Map<string, number>();

      for (const tx of monthExpenses) {
        const srcCur = accountMap.get(tx.accountId)?.currency ?? globalCurrency;
        const amt = getTransactionGlobalAmount(tx, srcCur, convertToGlobal, globalCurrency);
        if (amt >= largestAmt) {
          largestAmt = amt;
          largestTx = tx;
        }
        accountFreq.set(tx.accountId, (accountFreq.get(tx.accountId) ?? 0) + 1);
      }

      const avgSpend = monthSummary.totalExpenses / monthExpenses.length;
      const topAccountEntry = Array.from(accountFreq.entries()).sort((a, b) => b[1] - a[1])[0];
      const topAccountName = topAccountEntry ? accountMap.get(topAccountEntry[0])?.name : undefined;
      const largestCat =
        (largestTx.categoryId ? categories.find((c) => c.id === largestTx.categoryId)?.name : undefined) ??
        largestTx.category ??
        (isEs ? 'Sin categoría' : 'Uncategorized');
      const descLabel = largestTx.description?.trim() || largestCat;

      return {
        intentId,
        answerText: isEs
          ? `Tu gasto más fuerte del mes fue "${descLabel}" por ${fmt(largestAmt)} (${largestCat}, el ${largestTx.date}).\n\nEn total llevas ${monthExpenses.length} gasto${monthExpenses.length === 1 ? '' : 's'} con un promedio de ${fmt(avgSpend)} por compra${topAccountName ? `, usando principalmente "${topAccountName}"` : ''}.`
          : `Your largest expense this month was "${descLabel}" for ${fmt(largestAmt)} (${largestCat}, on ${largestTx.date}).\n\nYou've logged ${monthExpenses.length} expense${monthExpenses.length === 1 ? '' : 's'} averaging ${fmt(avgSpend)} per purchase${topAccountName ? `, mostly from "${topAccountName}"` : ''}.`,
        highlights: [
          {
            label: isEs ? 'Gasto más alto' : 'Largest Expense',
            value: fmt(largestAmt),
            tone: 'coral',
          },
          {
            label: isEs ? 'Promedio / compra' : 'Avg. per Purchase',
            value: fmt(avgSpend),
            tone: 'neutral',
          },
          {
            label: isEs ? 'Movimientos' : 'Movements',
            value: String(monthExpenses.length),
            tone: 'accent',
          },
        ],
        actionLink: {
          label: isEs ? 'Ver Movimientos' : 'View Transactions',
          targetTab: 'transactions',
        },
        followUpIds: ['daily_burn', 'spending_breakdown', 'month_comparison'],
      };
    }

    case 'income_sources': {
      const incomeMap = new Map<string, number>();
      for (const tx of monthTxs) {
        if (tx.excludeFromCashFlow || tx.type !== 'income') continue;
        const srcCur = accountMap.get(tx.accountId)?.currency ?? globalCurrency;
        const amt = getTransactionGlobalAmount(tx, srcCur, convertToGlobal, globalCurrency);
        const catName =
          (tx.categoryId ? categories.find((c) => c.id === tx.categoryId)?.name : undefined) ??
          tx.category ??
          (isEs ? 'Otros ingresos' : 'Other Income');
        incomeMap.set(catName, (incomeMap.get(catName) ?? 0) + amt);
      }

      const rankedIncome = Array.from(incomeMap.entries()).sort((a, b) => b[1] - a[1]);
      const goalTarget = budgetSummary.totalIncomeGoal;
      const remainingToGoal = Math.max(0, goalTarget - monthSummary.totalIncome);
      const goalPct = goalTarget > 0 ? Math.round((monthSummary.totalIncome / goalTarget) * 100) : 0;

      const sourceLines = rankedIncome.slice(0, 4).map(([name, val], i) => {
        const pct = monthSummary.totalIncome > 0 ? Math.round((val / monthSummary.totalIncome) * 100) : 0;
        return `${i + 1}. ${name}: ${fmt(val)} (${pct}%)`;
      });

      const goalText =
        goalTarget > 0
          ? remainingToGoal > 0
            ? isEs
              ? `\n\nLlevas el ${goalPct}% de tu meta mensual (${fmt(goalTarget)}); te faltan ${fmt(remainingToGoal)} para llegar al 100%.`
              : `\n\nYou've reached ${goalPct}% of your monthly income goal (${fmt(goalTarget)}), with ${fmt(remainingToGoal)} left to hit 100%.`
            : isEs
              ? `\n\n¡Meta cumplida! Ya alcanzaste el ${goalPct}% de tu objetivo mensual (${fmt(goalTarget)}).`
              : `\n\nGoal achieved! You've reached ${goalPct}% of your monthly target (${fmt(goalTarget)}).`
          : isEs
            ? '\n\nAún no has definido metas de ingreso en Presupuestos.'
            : "\n\nYou haven't set income goals in Budgets yet.";

      return {
        intentId,
        answerText:
          rankedIncome.length === 0
            ? isEs
              ? `Aún no registras ingresos este mes.${goalText}`
              : `You haven't recorded any income this month yet.${goalText}`
            : isEs
              ? `Tus ingresos del mes suman ${fmt(monthSummary.totalIncome)}, provenientes de:\n\n${sourceLines.join('\n')}${goalText}`
              : `Your income this month totals ${fmt(monthSummary.totalIncome)}, coming from:\n\n${sourceLines.join('\n')}${goalText}`,
        highlights: [
          {
            label: isEs ? 'Ingresos del mes' : 'Monthly Income',
            value: fmt(monthSummary.totalIncome),
            tone: 'accent',
          },
          {
            label: isEs ? 'Avance de meta' : 'Goal Progress',
            value: goalTarget > 0 ? `${goalPct}%` : '—',
            tone: goalPct >= 100 ? 'accent' : 'neutral',
          },
          {
            label: isEs ? 'Falta para meta' : 'Remaining to Goal',
            value: goalTarget > 0 ? fmt(remainingToGoal) : '—',
            tone: remainingToGoal === 0 && goalTarget > 0 ? 'accent' : 'neutral',
          },
        ],
        actionLink: {
          label: isEs ? 'Ver Metas y Presupuestos' : 'View Budgets & Goals',
          targetTab: 'budgets',
        },
        followUpIds: ['savings_projection', 'month_comparison', 'health_check'],
      };
    }

    case 'debt_payoff_speed': {
      const totalDebt = loanSummary.totalPayable;
      if (totalDebt <= 0) {
        return {
          intentId,
          answerText: isEs
            ? '¡Excelente noticia! Actualmente no tienes deudas pendientes por pagar. Tu enfoque puede ir directo a hacer crecer tu ahorro y patrimonio.'
            : "Great news! You currently have zero debts to pay off. You can put your energy directly into growing your savings and net worth.",
          highlights: [
            { label: isEs ? 'Deuda total' : 'Total Debt', value: fmt(0), tone: 'accent' },
            { label: isEs ? 'Dinero disponible' : 'Available Cash', value: fmt(totalLiquid), tone: 'accent' },
          ],
          actionLink: {
            label: isEs ? 'Ver Préstamos' : 'View Loans',
            targetTab: 'loans',
          },
          followUpIds: ['net_worth', 'savings_projection', 'health_check'],
        };
      }

      const payableLoanIds = new Set(
        loans.filter((l) => l.direction === 'payable' && !isLoanSettled(l)).map((l) => l.id)
      );
      let scheduledMonthlyDebt = 0;
      for (const sub of subscriptions) {
        if (!sub.isActive || !sub.linkedLoanId || !payableLoanIds.has(sub.linkedLoanId)) continue;
        const srcCur = accountMap.get(sub.accountId)?.currency ?? globalCurrency;
        scheduledMonthlyDebt += convertToGlobal(
          calculateMonthlyEquivalent(sub.amount, sub.frequency),
          srcCur
        );
      }

      const surplus = Math.max(0, monthSummary.netCashFlow);
      const pace25 = surplus * 0.25 + scheduledMonthlyDebt;
      const pace50 = surplus * 0.5 + scheduledMonthlyDebt;
      const months25 = pace25 > 0 ? Math.ceil(totalDebt / pace25) : null;
      const months50 = pace50 > 0 ? Math.ceil(totalDebt / pace50) : null;

      const paceNote =
        months25 !== null && months50 !== null
          ? isEs
            ? `Si destinas el 25% de tu balance positivo mensual (más tus pagos ya programados), podrías liquidar todo en ~${months25} mes${months25 === 1 ? '' : 'es'}; destinando el 50%, bajaría a ~${months50} mes${months50 === 1 ? '' : 'es'}.`
            : `If you put 25% of your monthly surplus toward debt (plus scheduled payments), you could be debt-free in ~${months25} month${months25 === 1 ? '' : 's'}; at 50%, that drops to ~${months50} month${months50 === 1 ? '' : 's'}.`
          : isEs
            ? 'Tu balance mensual actual aún no deja excedente positivo para acelerar abonos extra.'
            : "Your current monthly balance doesn't leave extra surplus yet to accelerate payments.";

      return {
        intentId,
        answerText: isEs
          ? `Debes un total de ${fmt(totalDebt)} y tienes ${fmt(scheduledMonthlyDebt)}/mes automatizados en pagos recurrentes.\n\n${paceNote}`
          : `You owe ${fmt(totalDebt)} in total, with ${fmt(scheduledMonthlyDebt)}/mo automated via recurring payments.\n\n${paceNote}`,
        highlights: [
          {
            label: isEs ? 'Deuda total' : 'Total Debt',
            value: fmt(totalDebt),
            tone: 'coral',
          },
          {
            label: isEs ? 'Programado / mes' : 'Scheduled / mo',
            value: fmt(scheduledMonthlyDebt),
            tone: 'neutral',
          },
          {
            label: isEs ? 'Liquidación est.' : 'Est. Payoff',
            value:
              months50 !== null
                ? isEs
                  ? `~${months50} meses`
                  : `~${months50} mo`
                : '—',
            tone: months50 !== null ? 'accent' : 'neutral',
          },
        ],
        actionLink: {
          label: isEs ? 'Administrar Préstamos' : 'Manage Loans',
          targetTab: 'loans',
        },
        followUpIds: ['loans_overview', 'recurring_impact', 'action_plan'],
      };
    }

    case 'month_comparison': {
      const prevMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthTxs = transactions.filter((tx) =>
        isTransactionInCurrentMonth(tx.date, prevMonthRef, tz)
      );
      const prevSummary = calculateTransactionSummary(
        prevMonthTxs,
        accounts,
        convertToGlobal,
        globalCurrency
      );

      if (prevMonthTxs.length === 0) {
        return {
          intentId,
          answerText: isEs
            ? `Este mes llevas ${fmt(monthSummary.totalIncome)} en ingresos, ${fmt(monthSummary.totalExpenses)} en gastos y un balance neto de ${fmt(monthSummary.netCashFlow)}.\n\nNo hay movimientos registrados del mes pasado todavía, así que este mes servirá como tu punto de referencia.`
            : `So far this month you have ${fmt(monthSummary.totalIncome)} in income, ${fmt(monthSummary.totalExpenses)} in expenses, and a net balance of ${fmt(monthSummary.netCashFlow)}.\n\nThere were no movements recorded last month, so this month will serve as your baseline.`,
          highlights: [
            {
              label: isEs ? 'Balance este mes' : 'This Month Net',
              value: fmt(monthSummary.netCashFlow),
              tone: monthSummary.netCashFlow >= 0 ? 'accent' : 'coral',
            },
            {
              label: isEs ? 'Mes pasado' : 'Last Month Net',
              value: fmt(0),
              tone: 'neutral',
            },
            {
              label: isEs ? 'Cambio en gastos' : 'Expense Change',
              value: '—',
              tone: 'neutral',
            },
          ],
          actionLink: {
            label: isEs ? 'Ver Movimientos' : 'View Transactions',
            targetTab: 'transactions',
          },
          followUpIds: ['daily_burn', 'income_sources', 'savings_projection'],
        };
      }

      const expDeltaPct =
        prevSummary.totalExpenses > 0
          ? Math.round(
              ((monthSummary.totalExpenses - prevSummary.totalExpenses) / prevSummary.totalExpenses) *
                100
            )
          : 0;
      const expDeltaLabel = `${expDeltaPct > 0 ? '+' : ''}${expDeltaPct}%`;

      return {
        intentId,
        answerText: isEs
          ? `Comparado con el mes pasado:\n\n• Ingresos: ${fmt(monthSummary.totalIncome)} vs. ${fmt(prevSummary.totalIncome)} el mes anterior.\n• Gastos: ${fmt(monthSummary.totalExpenses)} vs. ${fmt(prevSummary.totalExpenses)} (${expDeltaLabel}).\n• Balance neto: ${fmt(monthSummary.netCashFlow)} frente a ${fmt(prevSummary.netCashFlow)}.`
          : `Compared to last month:\n\n• Income: ${fmt(monthSummary.totalIncome)} vs. ${fmt(prevSummary.totalIncome)} last month.\n• Expenses: ${fmt(monthSummary.totalExpenses)} vs. ${fmt(prevSummary.totalExpenses)} (${expDeltaLabel}).\n• Net balance: ${fmt(monthSummary.netCashFlow)} vs. ${fmt(prevSummary.netCashFlow)}.`,
        highlights: [
          {
            label: isEs ? 'Balance este mes' : 'This Month Net',
            value: fmt(monthSummary.netCashFlow),
            tone: monthSummary.netCashFlow >= 0 ? 'accent' : 'coral',
          },
          {
            label: isEs ? 'Mes pasado' : 'Last Month Net',
            value: fmt(prevSummary.netCashFlow),
            tone: prevSummary.netCashFlow >= 0 ? 'neutral' : 'coral',
          },
          {
            label: isEs ? 'Cambio en gastos' : 'Expense Change',
            value: prevSummary.totalExpenses > 0 ? expDeltaLabel : '—',
            tone: expDeltaPct <= 0 ? 'accent' : 'coral',
          },
        ],
        actionLink: {
          label: isEs ? 'Ver Movimientos' : 'View Transactions',
          targetTab: 'transactions',
        },
        followUpIds: ['daily_burn', 'income_sources', 'savings_projection'],
      };
    }
  }
}
