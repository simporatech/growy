import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  Account,
  AccountsSortOption,
  BudgetCategory,
  Loan,
  SortDirection,
  Subscription,
  Transaction,
  ViewFiltersPreferences,
} from '../types/finance';
import { detectUserEnvironment, formatDateYYYYMMDD } from '../utils/localeDetection';

export type Locale = 'en' | 'es';

export interface UserPreferences {
  accentColor: string;
  currency: string;
  language: Locale;
  timezone?: string;
  sidebarCollapsed: boolean;
  accountsSortBy: AccountsSortOption;
  accountsSortDirection: SortDirection;
  viewFilters?: ViewFiltersPreferences;
}

export interface UserFinancialData {
  accounts: Account[];
  transactions: Transaction[];
  budgets: BudgetCategory[];
  subscriptions: Subscription[];
  loans: Loan[];
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  preferences: UserPreferences;
  data: UserFinancialData;
}

interface StoredUserRecord extends UserProfile {
  passwordHash: string;
}

interface GrowyBackupFile {
  version: 1;
  app: 'growy';
  exportedAt: string;
  profile: StoredUserRecord;
}

interface CreateAccountInput {
  fullName: string;
  email: string;
  pin: string;
  language?: Locale;
}

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  signIn: (email: string, pin: string) => Promise<void>;
  createAccount: (input: CreateAccountInput) => Promise<void>;
  updateUserPreferences: (partialPrefs: Partial<UserPreferences>) => void;
  addFinancialAccount: (account: Omit<Account, 'id' | 'createdAt'>) => Account;
  updateFinancialAccount: (id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>) => void;
  deleteFinancialAccount: (id: string) => void;
  addBudgetCategory: (category: Omit<BudgetCategory, 'id' | 'createdAt'>) => BudgetCategory;
  updateBudgetCategory: (
    id: string,
    updates: Partial<Omit<BudgetCategory, 'id' | 'createdAt'>>
  ) => void;
  deleteBudgetCategory: (id: string) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Transaction;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => void;
  deleteTransaction: (id: string) => void;
  addSubscription: (sub: Omit<Subscription, 'id' | 'createdAt'>) => Subscription;
  updateSubscription: (
    id: string,
    updates: Partial<Omit<Subscription, 'id' | 'createdAt'>>
  ) => void;
  deleteSubscription: (id: string) => void;
  applyAutoBilling: (
    generatedTransactions: Transaction[],
    updatedSubscriptions: Subscription[],
    updatedLoans?: Loan[]
  ) => void;
  addLoan: (
    loan: Omit<Loan, 'id' | 'createdAt'>,
    disbursementTx?: Omit<Transaction, 'id' | 'createdAt' | 'loanId'>
  ) => Loan;
  updateLoan: (id: string, updates: Partial<Omit<Loan, 'id' | 'createdAt'>>) => void;
  deleteLoan: (id: string) => void;
  recordLoanPayment: (
    loanId: string,
    paymentInLoanCurrency: number,
    txs: Array<Omit<Transaction, 'id' | 'createdAt' | 'loanId'>>
  ) => void;
  restoreFromBackup: (rawJson: string) => Promise<UserProfile>;
  exportBackup: () => string;
  exportUserBackup: () => void;
  importUserBackup: (file: File) => Promise<{ ok: boolean; errorKey?: string }>;
  resetFinancialData: () => void;
  signOut: () => void;
  deleteAccount: () => void;
}

const EMAIL_INDEX_KEY = 'growy_email_index_v1';
const SESSION_KEY = 'growy_session_v1';
const USER_KEY_PREFIX = 'growy_user_';

export const DEFAULT_PREFERENCES: UserPreferences = {
  accentColor: '#97f2cc',
  currency: 'USD',
  language: 'en',
  sidebarCollapsed: false,
  accountsSortBy: 'createdAt',
  accountsSortDirection: 'desc',
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getUserStorageKey(id: string): string {
  return `${USER_KEY_PREFIX}${id}`;
}

async function hashPassword(password: string, email: string): Promise<string> {
  const payload = `${normalizeEmail(email)}::${password}`;
  const encoded = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function readEmailIndex(): Record<string, string> {
  try {
    const raw = localStorage.getItem(EMAIL_INDEX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeEmailIndex(index: Record<string, string>): void {
  localStorage.setItem(EMAIL_INDEX_KEY, JSON.stringify(index));
}

function readUserRecord(id: string): StoredUserRecord | null {
  try {
    const raw = localStorage.getItem(getUserStorageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUserRecord;
    return parsed && typeof parsed === 'object' && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

function writeUserRecord(record: StoredUserRecord): void {
  localStorage.setItem(getUserStorageKey(record.id), JSON.stringify(record));
}

const VALID_SORT_OPTIONS = new Set<AccountsSortOption>([
  'createdAt',
  'name',
  'balance',
  'currency',
  'type',
]);

function normalizeSortOption(val: unknown): AccountsSortOption {
  if (val === 'default') return 'createdAt';
  if (val === 'alphabetical') return 'name';
  if (val === 'highest_balance') return 'balance';
  return typeof val === 'string' && VALID_SORT_OPTIONS.has(val as AccountsSortOption)
    ? (val as AccountsSortOption)
    : 'createdAt';
}

function normalizeSortDirection(val: unknown): SortDirection {
  return val === 'asc' || val === 'desc' ? val : 'desc';
}

function toPublicProfile(record: StoredUserRecord): UserProfile {
  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    createdAt: record.createdAt,
    preferences: {
      accentColor: record.preferences?.accentColor || DEFAULT_PREFERENCES.accentColor,
      currency: record.preferences?.currency || DEFAULT_PREFERENCES.currency,
      language: record.preferences?.language === 'es' ? 'es' : 'en',
      timezone: record.preferences?.timezone,
      sidebarCollapsed: Boolean(record.preferences?.sidebarCollapsed),
      accountsSortBy: normalizeSortOption(record.preferences?.accountsSortBy),
      accountsSortDirection: normalizeSortDirection(record.preferences?.accountsSortDirection),
      viewFilters: record.preferences?.viewFilters,
    },
    data: {
      accounts: Array.isArray(record.data?.accounts) ? record.data.accounts : [],
      transactions: Array.isArray(record.data?.transactions) ? record.data.transactions : [],
      budgets: Array.isArray(record.data?.budgets) ? record.data.budgets : [],
      subscriptions: Array.isArray(record.data?.subscriptions) ? record.data.subscriptions : [],
      loans: Array.isArray(record.data?.loans) ? record.data.loans : [],
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const sessionId = localStorage.getItem(SESSION_KEY);
      if (sessionId) {
        const record = readUserRecord(sessionId);
        if (record) {
          setUser(toPublicProfile(record));
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email: string, pin: string) => {
    const normalized = normalizeEmail(email);
    const index = readEmailIndex();
    const userId = index[normalized];
    const record = userId ? readUserRecord(userId) : null;

    if (!record) {
      throw new Error('auth.errorAccountNotFound');
    }

    const candidateHash = await hashPassword(pin, normalized);
    if (candidateHash !== record.passwordHash) {
      throw new Error('auth.errorWrongPassword');
    }

    localStorage.setItem(SESSION_KEY, record.id);
    setUser(toPublicProfile(record));
  }, []);

  const createAccount = useCallback(async (input: CreateAccountInput) => {
    const normalized = normalizeEmail(input.email);
    const index = readEmailIndex();

    if (index[normalized] && readUserRecord(index[normalized])) {
      throw new Error('auth.errorAccountExists');
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(input.pin, normalized);
    const detected = detectUserEnvironment();
    const record: StoredUserRecord = {
      id,
      fullName: input.fullName.trim(),
      email: normalized,
      passwordHash,
      createdAt: new Date().toISOString(),
      preferences: {
        accentColor: DEFAULT_PREFERENCES.accentColor,
        currency: detected.currency,
        language: input.language === 'es' || input.language === 'en' ? input.language : detected.language,
        timezone: detected.timezone,
        sidebarCollapsed: DEFAULT_PREFERENCES.sidebarCollapsed,
        accountsSortBy: DEFAULT_PREFERENCES.accountsSortBy,
        accountsSortDirection: DEFAULT_PREFERENCES.accountsSortDirection,
      },
      data: {
        accounts: [],
        transactions: [],
        budgets: [],
        subscriptions: [],
        loans: [],
      },
    };

    writeUserRecord(record);
    index[normalized] = id;
    writeEmailIndex(index);
    localStorage.setItem(SESSION_KEY, id);
    setUser(toPublicProfile(record));
  }, []);

  const updateUserPreferences = useCallback((partialPrefs: Partial<UserPreferences>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const nextViewFilters =
        'viewFilters' in partialPrefs
          ? partialPrefs.viewFilters === undefined
            ? undefined
            : {
                ...prev.preferences.viewFilters,
                ...partialPrefs.viewFilters,
              }
          : prev.preferences.viewFilters;

      const nextPreferences: UserPreferences = {
        ...prev.preferences,
        ...partialPrefs,
        viewFilters: nextViewFilters,
      };
      const updatedProfile: UserProfile = {
        ...prev,
        preferences: nextPreferences,
      };
      const existing = readUserRecord(prev.id);
      if (existing) {
        writeUserRecord({
          ...existing,
          preferences: nextPreferences,
        });
      }
      return updatedProfile;
    });
  }, []);

  const addFinancialAccount = useCallback(
    (input: Omit<Account, 'id' | 'createdAt'>): Account => {
      const newAccount: Account = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setUser((prev) => {
        if (!prev) return prev;
        const nextData: UserFinancialData = {
          ...prev.data,
          accounts: [newAccount, ...prev.data.accounts],
        };
        const updatedProfile: UserProfile = { ...prev, data: nextData };
        const existing = readUserRecord(prev.id);
        if (existing) {
          writeUserRecord({ ...existing, data: nextData });
        }
        return updatedProfile;
      });
      return newAccount;
    },
    []
  );

  const updateFinancialAccount = useCallback(
    (id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const nextAccounts = prev.data.accounts.map((acc) =>
          acc.id === id ? { ...acc, ...updates } : acc
        );
        const nextData: UserFinancialData = { ...prev.data, accounts: nextAccounts };
        const updatedProfile: UserProfile = { ...prev, data: nextData };
        const existing = readUserRecord(prev.id);
        if (existing) {
          writeUserRecord({ ...existing, data: nextData });
        }
        return updatedProfile;
      });
    },
    []
  );

  const deleteFinancialAccount = useCallback((id: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const nextAccounts = prev.data.accounts.filter((acc) => acc.id !== id);
      const nextData: UserFinancialData = { ...prev.data, accounts: nextAccounts };
      const updatedProfile: UserProfile = { ...prev, data: nextData };
      const existing = readUserRecord(prev.id);
      if (existing) {
        writeUserRecord({ ...existing, data: nextData });
      }
      return updatedProfile;
    });
  }, []);

  const addBudgetCategory = useCallback(
    (input: Omit<BudgetCategory, 'id' | 'createdAt'>): BudgetCategory => {
      const newCategory: BudgetCategory = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setUser((prev) => {
        if (!prev) return prev;
        const nextData: UserFinancialData = {
          ...prev.data,
          budgets: [newCategory, ...prev.data.budgets],
        };
        const updatedProfile: UserProfile = { ...prev, data: nextData };
        const existing = readUserRecord(prev.id);
        if (existing) {
          writeUserRecord({ ...existing, data: nextData });
        }
        return updatedProfile;
      });
      return newCategory;
    },
    []
  );

  const updateBudgetCategory = useCallback(
    (id: string, updates: Partial<Omit<BudgetCategory, 'id' | 'createdAt'>>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const nextBudgets = prev.data.budgets.map((cat) =>
          cat.id === id ? { ...cat, ...updates } : cat
        );
        const nextData: UserFinancialData = { ...prev.data, budgets: nextBudgets };
        const updatedProfile: UserProfile = { ...prev, data: nextData };
        const existing = readUserRecord(prev.id);
        if (existing) {
          writeUserRecord({ ...existing, data: nextData });
        }
        return updatedProfile;
      });
    },
    []
  );

  const deleteBudgetCategory = useCallback((id: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const nextBudgets = prev.data.budgets.filter((cat) => cat.id !== id);
      const nextData: UserFinancialData = { ...prev.data, budgets: nextBudgets };
      const updatedProfile: UserProfile = { ...prev, data: nextData };
      const existing = readUserRecord(prev.id);
      if (existing) {
        writeUserRecord({ ...existing, data: nextData });
      }
      return updatedProfile;
    });
  }, []);

  const addTransaction = useCallback((input: Omit<Transaction, 'id' | 'createdAt'>): Transaction => {
    const newTx: Transaction = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setUser((prev) => {
      if (!prev) return prev;
      const nextData: UserFinancialData = {
        ...prev.data,
        transactions: [newTx, ...prev.data.transactions],
      };
      const updatedProfile: UserProfile = { ...prev, data: nextData };
      const existing = readUserRecord(prev.id);
      if (existing) {
        writeUserRecord({ ...existing, data: nextData });
      }
      return updatedProfile;
    });
    return newTx;
  }, []);

  const updateTransaction = useCallback(
    (id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const nextTransactions = prev.data.transactions.map((tx) =>
          tx.id === id ? { ...tx, ...updates } : tx
        );
        const nextData: UserFinancialData = { ...prev.data, transactions: nextTransactions };
        const updatedProfile: UserProfile = { ...prev, data: nextData };
        const existing = readUserRecord(prev.id);
        if (existing) {
          writeUserRecord({ ...existing, data: nextData });
        }
        return updatedProfile;
      });
    },
    []
  );

  const deleteTransaction = useCallback((id: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const targetTx = prev.data.transactions.find((tx) => tx.id === id);
      if (!targetTx) return prev;

      let nextTransactions: Transaction[];
      let nextLoans = prev.data.loans ?? [];
      let nextSubscriptions = prev.data.subscriptions ?? [];

      if (targetTx.loanId && targetTx.loanEntryKind === 'disbursement') {
        // Case A: Deleting the initial loan disbursement cascades to the entire loan and its repayments
        const targetLoanId = targetTx.loanId;
        nextLoans = nextLoans.filter((loan) => loan.id !== targetLoanId);
        nextTransactions = prev.data.transactions.filter((tx) => tx.loanId !== targetLoanId);
        nextSubscriptions = nextSubscriptions.map((sub) =>
          sub.linkedLoanId === targetLoanId ? { ...sub, linkedLoanId: undefined } : sub
        );
      } else if (targetTx.loanId && targetTx.loanEntryKind === 'repayment') {
        // Case B: Deleting a loan repayment recalculates paidAmount from remaining repayments
        const targetLoanId = targetTx.loanId;
        nextTransactions = prev.data.transactions.filter((tx) => tx.id !== id);
        const recalculatedPaid = nextTransactions
          .filter((tx) => tx.loanId === targetLoanId && tx.loanEntryKind === 'repayment')
          .reduce((sum, tx) => sum + (Number(tx.toAmount ?? tx.amount) || 0), 0);
        nextLoans = nextLoans.map((loan) =>
          loan.id === targetLoanId ? { ...loan, paidAmount: Math.max(0, recalculatedPaid) } : loan
        );
      } else {
        // Case C: Standard transaction deletion
        nextTransactions = prev.data.transactions.filter((tx) => tx.id !== id);
      }

      const nextData: UserFinancialData = {
        ...prev.data,
        transactions: nextTransactions,
        loans: nextLoans,
        subscriptions: nextSubscriptions,
      };
      const updatedProfile: UserProfile = { ...prev, data: nextData };
      const existing = readUserRecord(prev.id);
      if (existing) {
        writeUserRecord({ ...existing, data: nextData });
      }
      return updatedProfile;
    });
  }, []);

  const addSubscription = useCallback(
    (input: Omit<Subscription, 'id' | 'createdAt'>): Subscription => {
      const newSub: Subscription = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setUser((prev) => {
        if (!prev) return prev;
        const nextData: UserFinancialData = {
          ...prev.data,
          subscriptions: [newSub, ...(prev.data.subscriptions ?? [])],
        };
        const updatedProfile: UserProfile = { ...prev, data: nextData };
        const existing = readUserRecord(prev.id);
        if (existing) {
          writeUserRecord({ ...existing, data: nextData });
        }
        return updatedProfile;
      });
      return newSub;
    },
    []
  );

  const updateSubscription = useCallback(
    (id: string, updates: Partial<Omit<Subscription, 'id' | 'createdAt'>>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const nextSubs = (prev.data.subscriptions ?? []).map((sub) =>
          sub.id === id ? { ...sub, ...updates } : sub
        );
        const nextData: UserFinancialData = { ...prev.data, subscriptions: nextSubs };
        const updatedProfile: UserProfile = { ...prev, data: nextData };
        const existing = readUserRecord(prev.id);
        if (existing) {
          writeUserRecord({ ...existing, data: nextData });
        }
        return updatedProfile;
      });
    },
    []
  );

  const deleteSubscription = useCallback((id: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const nextSubs = (prev.data.subscriptions ?? []).filter((sub) => sub.id !== id);
      const nextData: UserFinancialData = { ...prev.data, subscriptions: nextSubs };
      const updatedProfile: UserProfile = { ...prev, data: nextData };
      const existing = readUserRecord(prev.id);
      if (existing) {
        writeUserRecord({ ...existing, data: nextData });
      }
      return updatedProfile;
    });
  }, []);

  const applyAutoBilling = useCallback(
    (
      generatedTransactions: Transaction[],
      updatedSubscriptions: Subscription[],
      updatedLoans?: Loan[]
    ) => {
      if (generatedTransactions.length === 0) return;
      setUser((prev) => {
        if (!prev) return prev;
        const nextData: UserFinancialData = {
          ...prev.data,
          transactions: [...generatedTransactions, ...prev.data.transactions],
          subscriptions: updatedSubscriptions,
          loans: updatedLoans ?? prev.data.loans ?? [],
        };
        const updatedProfile: UserProfile = { ...prev, data: nextData };
        const existing = readUserRecord(prev.id);
        if (existing) {
          writeUserRecord({ ...existing, data: nextData });
        }
        return updatedProfile;
      });
    },
    []
  );

  const addLoan = useCallback(
    (
      input: Omit<Loan, 'id' | 'createdAt'>,
      disbursementTx?: Omit<Transaction, 'id' | 'createdAt' | 'loanId'>
    ): Loan => {
      const newLoan: Loan = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      const createdTx: Transaction | null = disbursementTx
        ? {
            ...disbursementTx,
            id: crypto.randomUUID(),
            loanId: newLoan.id,
            loanEntryKind: 'disbursement',
            excludeFromCashFlow: true,
            createdAt: new Date().toISOString(),
          }
        : null;

      setUser((prev) => {
        if (!prev) return prev;
        const nextData: UserFinancialData = {
          ...prev.data,
          loans: [newLoan, ...(prev.data.loans ?? [])],
          transactions: createdTx
            ? [createdTx, ...prev.data.transactions]
            : prev.data.transactions,
        };
        const updatedProfile: UserProfile = { ...prev, data: nextData };
        const existing = readUserRecord(prev.id);
        if (existing) {
          writeUserRecord({ ...existing, data: nextData });
        }
        return updatedProfile;
      });
      return newLoan;
    },
    []
  );

  const updateLoan = useCallback(
    (id: string, updates: Partial<Omit<Loan, 'id' | 'createdAt'>>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const nextLoans = (prev.data.loans ?? []).map((loan) =>
          loan.id === id ? { ...loan, ...updates } : loan
        );
        const nextData: UserFinancialData = { ...prev.data, loans: nextLoans };
        const updatedProfile: UserProfile = { ...prev, data: nextData };
        const existing = readUserRecord(prev.id);
        if (existing) {
          writeUserRecord({ ...existing, data: nextData });
        }
        return updatedProfile;
      });
    },
    []
  );

  const deleteLoan = useCallback((id: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const nextLoans = (prev.data.loans ?? []).filter((loan) => loan.id !== id);
      const nextTransactions = prev.data.transactions.filter((tx) => tx.loanId !== id);
      const nextSubscriptions = (prev.data.subscriptions ?? []).map((sub) =>
        sub.linkedLoanId === id ? { ...sub, linkedLoanId: undefined } : sub
      );
      const nextData: UserFinancialData = {
        ...prev.data,
        loans: nextLoans,
        transactions: nextTransactions,
        subscriptions: nextSubscriptions,
      };
      const updatedProfile: UserProfile = { ...prev, data: nextData };
      const existing = readUserRecord(prev.id);
      if (existing) {
        writeUserRecord({ ...existing, data: nextData });
      }
      return updatedProfile;
    });
  }, []);

  const recordLoanPayment = useCallback(
    (
      loanId: string,
      paymentInLoanCurrency: number,
      txInputs: Array<Omit<Transaction, 'id' | 'createdAt' | 'loanId'>>
    ) => {
      const nowIso = new Date().toISOString();
      const createdTxs: Transaction[] = txInputs.map((txInput) => ({
        ...txInput,
        id: crypto.randomUUID(),
        loanId,
        excludeFromCashFlow: txInput.excludeFromCashFlow ?? true,
        createdAt: nowIso,
      }));

      setUser((prev) => {
        if (!prev) return prev;
        let isLoanNowSettled = false;
        const nextLoans = (prev.data.loans ?? []).map((loan) => {
          if (loan.id !== loanId) return loan;
          const nextPaid = Math.max(0, (Number(loan.paidAmount) || 0) + paymentInLoanCurrency);
          if (nextPaid >= loan.principalAmount) {
            isLoanNowSettled = true;
          }
          return {
            ...loan,
            paidAmount: nextPaid,
          };
        });
        const nextSubscriptions = isLoanNowSettled
          ? (prev.data.subscriptions ?? []).map((sub) =>
              sub.linkedLoanId === loanId && sub.isActive ? { ...sub, isActive: false } : sub
            )
          : prev.data.subscriptions ?? [];
        const nextData: UserFinancialData = {
          ...prev.data,
          loans: nextLoans,
          subscriptions: nextSubscriptions,
          transactions: [...createdTxs, ...prev.data.transactions],
        };
        const updatedProfile: UserProfile = { ...prev, data: nextData };
        const existing = readUserRecord(prev.id);
        if (existing) {
          writeUserRecord({ ...existing, data: nextData });
        }
        return updatedProfile;
      });
    },
    []
  );

  const restoreFromBackup = useCallback(async (rawJson: string): Promise<UserProfile> => {
    const parsed = JSON.parse(rawJson) as unknown;
    const candidate =
      parsed && typeof parsed === 'object' && 'profile' in parsed
        ? (parsed as { profile: unknown }).profile
        : parsed;

    if (!candidate || typeof candidate !== 'object') {
      throw new Error('auth.errorGeneric');
    }

    const rec = candidate as Partial<StoredUserRecord>;
    if (
      typeof rec.fullName !== 'string' ||
      !rec.fullName.trim() ||
      typeof rec.email !== 'string' ||
      !rec.email.includes('@') ||
      typeof rec.passwordHash !== 'string' ||
      rec.passwordHash.length !== 64
    ) {
      throw new Error('auth.errorGeneric');
    }

    const normalized = normalizeEmail(rec.email);
    const id = typeof rec.id === 'string' && rec.id ? rec.id : crypto.randomUUID();
    const restoredRecord: StoredUserRecord = {
      id,
      fullName: rec.fullName.trim(),
      email: normalized,
      passwordHash: rec.passwordHash,
      createdAt: typeof rec.createdAt === 'string' && rec.createdAt ? rec.createdAt : new Date().toISOString(),
      preferences: {
        accentColor: rec.preferences?.accentColor || DEFAULT_PREFERENCES.accentColor,
        currency: rec.preferences?.currency || DEFAULT_PREFERENCES.currency,
        language: rec.preferences?.language === 'es' ? 'es' : 'en',
        sidebarCollapsed: Boolean(rec.preferences?.sidebarCollapsed),
        accountsSortBy: normalizeSortOption(rec.preferences?.accountsSortBy),
        accountsSortDirection: normalizeSortDirection(rec.preferences?.accountsSortDirection),
      },
      data: {
        accounts: Array.isArray(rec.data?.accounts) ? rec.data.accounts : [],
        transactions: Array.isArray(rec.data?.transactions) ? rec.data.transactions : [],
        budgets: Array.isArray(rec.data?.budgets) ? rec.data.budgets : [],
        subscriptions: Array.isArray(rec.data?.subscriptions) ? rec.data.subscriptions : [],
        loans: Array.isArray(rec.data?.loans) ? rec.data.loans : [],
      },
    };

    writeUserRecord(restoredRecord);
    const index = readEmailIndex();
    index[normalized] = id;
    writeEmailIndex(index);
    localStorage.setItem(SESSION_KEY, id);

    const publicProfile = toPublicProfile(restoredRecord);
    setUser(publicProfile);
    return publicProfile;
  }, []);

  const exportBackup = useCallback((): string => {
    if (!user) {
      throw new Error('auth.errorGeneric');
    }
    const record = readUserRecord(user.id);
    if (!record) {
      throw new Error('auth.errorGeneric');
    }
    const backup: GrowyBackupFile = {
      version: 1,
      app: 'growy',
      exportedAt: new Date().toISOString(),
      profile: record,
    };
    return JSON.stringify(backup, null, 2);
  }, [user]);

  const exportUserBackup = useCallback((): void => {
    if (!user) return;
    const now = new Date();
    const dateStamp = formatDateYYYYMMDD(now, user.preferences.timezone);

    const backupPayload = {
      version: 1,
      app: 'growy',
      exportedAt: now.toISOString(),
      profile: {
        fullName: user.fullName,
        email: user.email,
        preferences: user.preferences,
      },
      data: {
        accounts: user.data.accounts,
        transactions: user.data.transactions,
        budgets: user.data.budgets,
        subscriptions: user.data.subscriptions ?? [],
        loans: user.data.loans ?? [],
      },
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `growy-backup-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [user]);

  const importUserBackup = useCallback(
    async (file: File): Promise<{ ok: boolean; errorKey?: string }> => {
      if (!user) {
        return { ok: false, errorKey: 'settings.backupInvalidFile' };
      }

      try {
        const rawText = await file.text();
        const parsed = JSON.parse(rawText) as Record<string, unknown> | null;
        if (!parsed || typeof parsed !== 'object') {
          return { ok: false, errorKey: 'settings.backupInvalidFile' };
        }

        // Support both new backup schema ({ data, profile }) and legacy ({ profile: { data } })
        const profileObj =
          parsed.profile && typeof parsed.profile === 'object'
            ? (parsed.profile as Record<string, unknown>)
            : null;
        const dataCandidate =
          parsed.data && typeof parsed.data === 'object'
            ? (parsed.data as Record<string, unknown>)
            : profileObj?.data && typeof profileObj.data === 'object'
              ? (profileObj.data as Record<string, unknown>)
              : null;

        if (
          !dataCandidate ||
          !Array.isArray(dataCandidate.accounts) ||
          !Array.isArray(dataCandidate.transactions) ||
          !Array.isArray(dataCandidate.budgets)
        ) {
          return { ok: false, errorKey: 'settings.backupInvalidFile' };
        }

        const nextData: UserFinancialData = {
          accounts: dataCandidate.accounts as Account[],
          transactions: dataCandidate.transactions as Transaction[],
          budgets: dataCandidate.budgets as BudgetCategory[],
          subscriptions: Array.isArray(dataCandidate.subscriptions)
            ? (dataCandidate.subscriptions as Subscription[])
            : [],
          loans: Array.isArray(dataCandidate.loans) ? (dataCandidate.loans as Loan[]) : [],
        };

        const prefsCandidate =
          profileObj?.preferences && typeof profileObj.preferences === 'object'
            ? (profileObj.preferences as Partial<UserPreferences>)
            : null;

        const existing = readUserRecord(user.id);
        if (!existing) {
          return { ok: false, errorKey: 'settings.backupInvalidFile' };
        }

        const nextPreferences: UserPreferences = prefsCandidate
          ? {
              accentColor:
                typeof prefsCandidate.accentColor === 'string' && prefsCandidate.accentColor
                  ? prefsCandidate.accentColor
                  : existing.preferences.accentColor,
              currency:
                typeof prefsCandidate.currency === 'string' && prefsCandidate.currency
                  ? prefsCandidate.currency
                  : existing.preferences.currency,
              language: prefsCandidate.language === 'es' ? 'es' : prefsCandidate.language === 'en' ? 'en' : existing.preferences.language,
              timezone:
                typeof prefsCandidate.timezone === 'string' && prefsCandidate.timezone
                  ? prefsCandidate.timezone
                  : existing.preferences.timezone,
              sidebarCollapsed:
                typeof prefsCandidate.sidebarCollapsed === 'boolean'
                  ? prefsCandidate.sidebarCollapsed
                  : existing.preferences.sidebarCollapsed,
              accountsSortBy: normalizeSortOption(
                prefsCandidate.accountsSortBy ?? existing.preferences.accountsSortBy
              ),
              accountsSortDirection: normalizeSortDirection(
                prefsCandidate.accountsSortDirection ?? existing.preferences.accountsSortDirection
              ),
              viewFilters:
                prefsCandidate.viewFilters && typeof prefsCandidate.viewFilters === 'object'
                  ? prefsCandidate.viewFilters
                  : undefined,
            }
          : existing.preferences;

        const updatedRecord: StoredUserRecord = {
          ...existing,
          preferences: nextPreferences,
          data: nextData,
        };

        writeUserRecord(updatedRecord);
        setUser(toPublicProfile(updatedRecord));
        return { ok: true };
      } catch {
        return { ok: false, errorKey: 'settings.backupInvalidFile' };
      }
    },
    [user]
  );

  const resetFinancialData = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const emptyData: UserFinancialData = {
        accounts: [],
        transactions: [],
        budgets: [],
        subscriptions: [],
        loans: [],
      };
      const cleanPreferences: UserPreferences = {
        ...prev.preferences,
        accountsSortBy: DEFAULT_PREFERENCES.accountsSortBy,
        accountsSortDirection: DEFAULT_PREFERENCES.accountsSortDirection,
        viewFilters: undefined,
      };
      const existing = readUserRecord(prev.id);
      if (existing) {
        writeUserRecord({
          ...existing,
          preferences: cleanPreferences,
          data: emptyData,
        });
      }
      return {
        ...prev,
        preferences: cleanPreferences,
        data: emptyData,
      };
    });
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const deleteAccount = useCallback(() => {
    if (!user) return;
    localStorage.removeItem(getUserStorageKey(user.id));
    const index = readEmailIndex();
    const normalized = normalizeEmail(user.email);
    if (index[normalized]) {
      delete index[normalized];
      writeEmailIndex(index);
    }
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        createAccount,
        updateUserPreferences,
        addFinancialAccount,
        updateFinancialAccount,
        deleteFinancialAccount,
        addBudgetCategory,
        updateBudgetCategory,
        deleteBudgetCategory,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addSubscription,
        updateSubscription,
        deleteSubscription,
        applyAutoBilling,
        addLoan,
        updateLoan,
        deleteLoan,
        recordLoanPayment,
        restoreFromBackup,
        exportBackup,
        exportUserBackup,
        importUserBackup,
        resetFinancialData,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
