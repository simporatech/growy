import React, { useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Locale, useLanguage } from '../../i18n/LanguageContext';
import { TranslationKey } from '../../i18n/locales/en';

type AuthMode = 'signin' | 'signup';

const CARD_LAYOUT_SPRING = {
  type: 'spring' as const,
  stiffness: 350,
  damping: 32,
  mass: 0.9,
};

const PILL_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 34,
};

const KNOWN_ERROR_KEYS = new Set<string>([
  'auth.errorAccountNotFound',
  'auth.errorWrongPassword',
  'auth.errorInvalidCredentials',
  'auth.errorEmailNotConfirmed',
  'auth.errorPasswordLength',
  'auth.errorAccountExists',
  'auth.errorGeneric',
]);

export function AuthScreen() {
  const { signIn, createAccount } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const [mode, setMode] = useState<AuthMode>('signin');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shakeCount, setShakeCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoSrc, setLogoSrc] = useState('/assets/brand/growy-logo.svg');

  const triggerError = (message: string) => {
    setNotice(null);
    setError(message);
    setShakeCount((c) => c + 1);
  };

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError(null);
    setNotice(null);
  };

  const validateForm = (): string | null => {
    const trimmedEmail = email.trim();
    if (mode === 'signup' && fullName.trim().length < 2) {
      return t('auth.errorNameLength');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return t('auth.errorInvalidEmail');
    }
    if (pin.length < 6) {
      return t('auth.errorPasswordLength');
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const validationError = validateForm();
    if (validationError) {
      triggerError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn(email, pin);
      } else {
        await createAccount({ fullName, email, pin, language: locale });
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'auth.noticeConfirmEmail') {
          setNotice(t('auth.noticeConfirmEmail'));
        } else if (KNOWN_ERROR_KEYS.has(err.message)) {
          triggerError(t(err.message as TranslationKey));
        } else if (err.message.trim()) {
          triggerError(err.message);
        } else {
          triggerError(t('auth.errorGeneric'));
        }
      } else {
        triggerError(t('auth.errorGeneric'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="ambient-bg relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-between px-4 py-8 sm:py-12">
        {/* Ambient Aurora Orbs (exclusively --accent-color) */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
          <motion.div
            animate={{
              x: [0, 28, -18, 0],
              y: [0, -22, 14, 0],
              scale: [1, 1.08, 0.96, 1],
              opacity: [0.09, 0.12, 0.08, 0.09],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            className="bg-dynamic-accent absolute -top-32 -left-24 h-[460px] w-[560px] rounded-full blur-[120px]"
          />
          <motion.div
            animate={{
              x: [0, -24, 16, 0],
              y: [0, 18, -14, 0],
              scale: [1, 0.94, 1.06, 1],
              opacity: [0.06, 0.08, 0.05, 0.06],
            }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            className="bg-dynamic-accent absolute -bottom-36 -right-24 h-[440px] w-[440px] rounded-full blur-[130px]"
          />
        </div>

        {/* Top-Right Language Switcher */}
        <div className="relative z-10 w-full max-w-[420px] flex justify-end mb-4 sm:mb-0 sm:fixed sm:top-6 sm:right-6 sm:w-auto">
          <div
            role="group"
            aria-label="Language"
            className="inline-flex items-center p-1 rounded-full bg-[#333333]/50 backdrop-blur-xl border border-white/[0.08]"
          >
            {(['en', 'es'] as Locale[]).map((code) => {
              const active = locale === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={`relative px-3 py-1 text-xs font-medium uppercase tracking-wider rounded-full transition-colors duration-200 ${
                    active ? 'text-white' : 'text-[#A3A3A3] hover:text-white/80'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="auth-lang-pill"
                      transition={PILL_SPRING}
                      className="absolute inset-0 rounded-full bg-white/[0.12] border border-white/[0.1]"
                    />
                  )}
                  <span className="relative z-10">{code}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Glass Card */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="relative z-10 w-full max-w-[420px] my-auto"
        >
          <motion.div
            key={shakeCount}
            animate={shakeCount > 0 ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.36, ease: 'easeOut' }}
          >
            <motion.div
              layout
              transition={CARD_LAYOUT_SPRING}
              className="glass-card p-7 sm:p-9 overflow-hidden"
            >
              {/* Brand Header */}
              <motion.div
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center text-center mb-7"
              >
                <motion.img
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.03, type: 'spring', stiffness: 340, damping: 26 }}
                  src={logoSrc}
                  alt="Growy"
                  onError={() => setLogoSrc('/assets/brand/growy-logo.png')}
                  className="h-12 w-12 object-contain mb-4 select-none"
                />

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${mode}-${locale}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white">
                      {mode === 'signin' ? t('auth.signInTitle') : t('auth.createAccountTitle')}
                    </h1>
                    <p className="mt-1.5 text-sm text-[#A3A3A3]">
                      {mode === 'signin' ? t('auth.signInSubtitle') : t('auth.createAccountSubtitle')}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              {/* Apple-style Segmented Pill Toggle with layoutId */}
              <motion.div
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                role="tablist"
                aria-label="Authentication mode"
                className="relative grid grid-cols-2 p-1 mb-6 rounded-2xl bg-black/30 border border-white/[0.06]"
              >
                {(['signin', 'signup'] as const).map((tabMode) => {
                  const isActive = mode === tabMode;
                  return (
                    <button
                      key={tabMode}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => switchMode(tabMode)}
                      className={`relative z-10 py-2 text-sm font-medium rounded-xl transition-colors duration-200 ${
                        isActive ? 'text-white' : 'text-[#A3A3A3] hover:text-white/80'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="auth-mode-pill"
                          transition={PILL_SPRING}
                          className="absolute inset-0 rounded-xl bg-[#333333]/85 border border-white/[0.1]"
                        />
                      )}
                      <span className="relative z-10">
                        {tabMode === 'signin' ? t('auth.signInTab') : t('auth.createAccountTab')}
                      </span>
                    </button>
                  );
                })}
              </motion.div>

              {/* Error / Confirmation Banner */}
              <AnimatePresence initial={false}>
                {(error || notice) && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    {notice ? (
                      <div
                        role="status"
                        className="mb-5 flex items-start gap-2.5 rounded-2xl border border-dynamic-accent bg-dynamic-accent-subtle px-3.5 py-3 text-xs leading-relaxed text-dynamic-accent"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{notice}</span>
                      </div>
                    ) : (
                      <div
                        role="alert"
                        className="mb-5 flex items-start gap-2.5 rounded-2xl border border-coral/30 bg-coral/10 px-3.5 py-3 text-xs leading-relaxed text-coral"
                      >
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Auth Form */}
              <motion.form
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                onSubmit={handleSubmit}
                noValidate
                className="space-y-4"
              >
                <AnimatePresence initial={false}>
                  {mode === 'signup' && (
                    <motion.div
                      key="fullname-field"
                      initial={{ opacity: 0, height: 0, y: -8 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -8 }}
                      transition={CARD_LAYOUT_SPRING}
                      className="overflow-hidden"
                    >
                      <div className="pb-0.5">
                        <label
                          htmlFor="growy-fullname"
                          className="block text-xs font-medium text-[#A3A3A3] mb-1.5"
                        >
                          {t('auth.fullNameLabel')}
                        </label>
                        <div className="group relative">
                          <User className="group-focus-dynamic-accent pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A3A3A3] transition-colors duration-200" />
                          <input
                            id="growy-fullname"
                            type="text"
                            autoComplete="name"
                            placeholder={t('auth.fullNamePlaceholder')}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="focus-dynamic-accent w-full rounded-xl bg-black/25 border border-white/[0.08] pl-10 pr-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-white/25 outline-none transition-all duration-200"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div layout="position">
                  <label htmlFor="growy-email" className="block text-xs font-medium text-[#A3A3A3] mb-1.5">
                    {t('auth.emailLabel')}
                  </label>
                  <div className="group relative">
                    <Mail className="group-focus-dynamic-accent pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A3A3A3] transition-colors duration-200" />
                    <input
                      id="growy-email"
                      type="email"
                      autoComplete="email"
                      placeholder={t('auth.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="focus-dynamic-accent w-full rounded-xl bg-black/25 border border-white/[0.08] pl-10 pr-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-white/25 outline-none transition-all duration-200"
                    />
                  </div>
                </motion.div>

                <motion.div layout="position">
                  <label htmlFor="growy-password" className="block text-xs font-medium text-[#A3A3A3] mb-1.5">
                    {t('auth.passwordLabel')}
                  </label>
                  <div className="group relative">
                    <Lock className="group-focus-dynamic-accent pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A3A3A3] transition-colors duration-200" />
                    <input
                      id="growy-password"
                      type={showPin ? 'text' : 'password'}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      placeholder="••••••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="focus-dynamic-accent w-full rounded-xl bg-black/25 border border-white/[0.08] pl-10 pr-10 py-2.5 text-base sm:text-sm text-white placeholder:text-white/25 outline-none transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((prev) => !prev)}
                      aria-label={showPin ? t('auth.hidePassword') : t('auth.showPassword')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-white transition-colors"
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </motion.div>

                <motion.div layout="position" className="pt-1">
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.985 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                    style={{ color: 'var(--accent-foreground)' }}
                    className="bg-dynamic-accent w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150 hover:opacity-90 disabled:opacity-60 disabled:pointer-events-none"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isSubmitting ? (
                        <motion.span
                          key="loading"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.15 }}
                          className="inline-flex items-center gap-2"
                        >
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>
                            {mode === 'signin' ? t('auth.signingInButton') : t('auth.creatingAccountButton')}
                          </span>
                        </motion.span>
                      ) : (
                        <motion.span
                          key={`${mode}-${locale}`}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.15 }}
                          className="inline-flex items-center gap-2"
                        >
                          <span>
                            {mode === 'signin' ? t('auth.signInButton') : t('auth.createAccountButton')}
                          </span>
                          <ArrowRight className="h-4 w-4" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </motion.div>
              </motion.form>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Minimalist Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="relative z-10 mt-8 text-center"
        >
          <p className="text-xs tracking-wide text-[#A3A3A3]/80">
            {t('brand.poweredBy')}{' '}
            <span className="font-display font-semibold tracking-wider text-white/90">
              SIMP<span style={{ color: 'var(--accent-color)' }}>O</span>RA
            </span>
          </p>
        </motion.footer>
      </div>
    </MotionConfig>
  );
}
