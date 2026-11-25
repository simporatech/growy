export type AccountType = 'cash' | 'bank' | 'debit_card' | 'digital_wallet' | 'other';

export type AccountsSortOption =
  | 'createdAt'
  | 'name'
  | 'balance'
  | 'currency'
  | 'type';

export type SortDirection = 'asc' | 'desc';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: number;
  color: string;
  iconId: string;
  createdAt: string;
}

export type TransactionType = 'expense' | 'income' | 'transfer';

export type TransactionsSortOption = 'date' | 'amount' | 'category' | 'account';

export type TransactionPeriodFilter = 'all' | 'this_month' | 'last_30' | 'last_7';

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string; // 'YYYY-MM-DD'
  accountId: string;
  amount: number;
  categoryId?: string;
  category?: string;
  toAccountId?: string;
  toAmount?: number;
  globalAmountSnapshot?: number;
  snapshotCurrency?: string;
  loanId?: string;
  loanEntryKind?: 'disbursement' | 'repayment';
  recurringId?: string;
  excludeFromCashFlow?: boolean;
  description?: string;
  createdAt: string;
}

export type CategoryKind = 'expense' | 'income';

export type BudgetsSortOption =
  | 'createdAt'
  | 'name'
  | 'target'
  | 'actual'
  | 'progress';

export interface BudgetCategory {
  id: string;
  kind: CategoryKind;
  name: string;
  color: string;
  iconId: string;
  targetAmount: number;
  currency: string;
  createdAt: string;
}

export interface AccountsViewFilterPrefs {
  search: string;
  typeFilter: string;
  currencyFilter: string;
  sortBy: string;
  sortDirection: SortDirection;
}

export interface BudgetsViewFilterPrefs {
  activeTab: CategoryKind;
  search: string;
  statusFilter: string;
  periodFilter?: string;
  customStart?: string;
  customEnd?: string;
  sortBy: string;
  sortDirection: SortDirection;
}

export interface TransactionsViewFilterPrefs {
  search: string;
  typeFilter: string;
  accountFilter: string;
  categoryFilter: string;
  periodFilter: string;
  customStart?: string;
  customEnd?: string;
  sortBy: string;
  sortDirection: SortDirection;
}

export interface OverviewViewFilterPrefs {
  periodFilter: string;
  customStart?: string;
  customEnd?: string;
}

export type BillingFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';

export type SubscriptionsSortOption =
  | 'nextBillingDate'
  | 'amount'
  | 'name'
  | 'frequency'
  | 'createdAt';

export interface Subscription {
  id: string;
  kind?: TransactionType; // Defaults to 'expense' for backward compatibility
  name: string;
  iconId: string;
  color: string;
  frequency: BillingFrequency;
  nextBillingDate: string; // 'YYYY-MM-DD'
  accountId: string;
  categoryId?: string;
  amount: number; // Native amount in accountId's currency
  toAccountId?: string;
  toAmount?: number;
  linkedLoanId?: string;
  interestAmount?: number;
  interestCategoryId?: string;
  isActive: boolean;
  createdAt: string;
}

export type LoanDirection = 'payable' | 'receivable';

export type LoansSortOption =
  | 'dueDate'
  | 'remaining'
  | 'progress'
  | 'principal'
  | 'startDate';

export interface Loan {
  id: string;
  direction: LoanDirection;
  title: string;
  counterparty?: string;
  currency: string;
  principalAmount: number;
  paidAmount: number;
  startDate: string; // 'YYYY-MM-DD'
  dueDate: string; // 'YYYY-MM-DD'
  affectsAccountOnCreate: boolean;
  initialAccountId?: string;
  categoryId?: string;
  iconId: string;
  color: string;
  notes?: string;
  createdAt: string;
}

export interface LoansViewFilterPrefs {
  search: string;
  directionFilter: 'all' | LoanDirection;
  statusFilter: 'all' | 'active' | 'settled' | 'overdue';
  currencyFilter: string;
  sortBy: LoansSortOption;
  sortDirection: SortDirection;
}

export interface SubscriptionsViewFilterPrefs {
  search: string;
  kindFilter?: 'all' | TransactionType;
  statusFilter: 'all' | 'active' | 'paused';
  frequencyFilter: 'all' | BillingFrequency;
  accountFilter: string;
  sortBy: SubscriptionsSortOption;
  sortDirection: SortDirection;
}

export interface ViewFiltersPreferences {
  overview?: OverviewViewFilterPrefs;
  accounts?: AccountsViewFilterPrefs;
  budgets?: BudgetsViewFilterPrefs;
  transactions?: TransactionsViewFilterPrefs;
  subscriptions?: SubscriptionsViewFilterPrefs;
  loans?: LoansViewFilterPrefs;
}
