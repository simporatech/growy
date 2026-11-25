import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, RotateCcw, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  analyzeFinancialIntent,
  generateIntelligenceWelcome,
  getIntelligencePromptLabel,
  getIntelligencePrompts,
  IntelligenceIntentId,
  IntelligenceTargetView,
  IntelligenceTopicId,
} from '../../utils/intelligenceEngine';
import { ChatMessage, ChatMessageBubble } from './ChatMessageBubble';

interface GrowyIntelligenceViewProps {
  onNavigate: (targetTab: IntelligenceTargetView) => void;
}

export function GrowyIntelligenceView({ onNavigate }: GrowyIntelligenceViewProps) {
  const { user } = useAuth();
  const { currency: globalCurrency, convertBetween } = useCurrency();
  const { locale, t } = useLanguage();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [followUpIds, setFollowUpIds] = useState<IntelligenceIntentId[]>([]);
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const [activeTopic, setActiveTopic] = useState<IntelligenceTopicId>('all');

  const [thinkingMsgId, setThinkingMsgId] = useState<string | null>(null);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [streamedText, setStreamedText] = useState('');

  const feedRef = useRef<HTMLDivElement>(null);
  const thinkingTimerRef = useRef<number | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const fullStreamTextRef = useRef<string>('');

  const convertToGlobal = useCallback(
    (amount: number, from: string) => convertBetween(amount, from, globalCurrency),
    [convertBetween, globalCurrency]
  );

  const clearTimers = useCallback(() => {
    if (thinkingTimerRef.current !== null) {
      window.clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    if (streamTimerRef.current !== null) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  const initWelcome = useCallback(() => {
    if (!user) return;
    clearTimers();
    setThinkingMsgId(null);
    setStreamingMsgId(null);
    setStreamedText('');
    setShowAllPrompts(false);

    const welcome = generateIntelligenceWelcome(user, locale);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: welcome.greeting,
      },
    ]);
    setFollowUpIds(welcome.starterIds);
  }, [user, locale, clearTimers]);

  useEffect(() => {
    initWelcome();
    return () => clearTimers();
  }, [initWelcome, clearTimers]);

  const scrollToBottom = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, streamedText, thinkingMsgId, scrollToBottom]);

  const handleSkipStream = useCallback(() => {
    if (!streamingMsgId) return;
    if (streamTimerRef.current !== null) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setStreamedText(fullStreamTextRef.current);
    setStreamingMsgId(null);
  }, [streamingMsgId]);

  const handleSelectPrompt = useCallback(
    (intentId: IntelligenceIntentId) => {
      if (!user) return;
      // Finish any in-flight stream immediately
      clearTimers();
      setThinkingMsgId(null);
      setStreamingMsgId(null);

      const promptLabel = getIntelligencePromptLabel(intentId, locale);
      const result = analyzeFinancialIntent(
        intentId,
        user,
        convertToGlobal,
        globalCurrency,
        locale
      );

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: promptLabel,
      };
      const assistantMsgId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        text: result.answerText,
        highlights: result.highlights,
        actionLink: result.actionLink,
        healthScore: result.healthScore,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setFollowUpIds(result.followUpIds);
      setShowAllPrompts(false);
      setThinkingMsgId(assistantMsgId);
      setStreamedText('');
      fullStreamTextRef.current = result.answerText;

      thinkingTimerRef.current = window.setTimeout(() => {
        setThinkingMsgId(null);
        setStreamingMsgId(assistantMsgId);

        const tokens = result.answerText.split(/(\s+)/);
        let idx = 0;

        streamTimerRef.current = window.setInterval(() => {
          idx += 2; // stream word + whitespace smoothly
          if (idx >= tokens.length) {
            if (streamTimerRef.current !== null) {
              window.clearInterval(streamTimerRef.current);
              streamTimerRef.current = null;
            }
            setStreamedText(result.answerText);
            setStreamingMsgId(null);
          } else {
            setStreamedText(tokens.slice(0, idx).join(''));
          }
        }, 18);
      }, 400);
    },
    [user, locale, convertToGlobal, globalCurrency, clearTimers]
  );

  const allPrompts = useMemo(() => getIntelligencePrompts(locale), [locale]);
  const followUpPrompts = useMemo(
    () =>
      followUpIds.map((id) => ({
        id,
        label: getIntelligencePromptLabel(id, locale),
      })),
    [followUpIds, locale]
  );
  const filteredDrawerPrompts = useMemo(
    () =>
      activeTopic === 'all'
        ? allPrompts
        : allPrompts.filter((p) => p.topic === activeTopic),
    [allPrompts, activeTopic]
  );

  const topicTabs: Array<{ id: IntelligenceTopicId; label: string }> = useMemo(
    () => [
      { id: 'all', label: `${t('intelligence.topic.all')} (${allPrompts.length})` },
      { id: 'cash_spending', label: t('intelligence.topic.cashSpending') },
      { id: 'budgets_goals', label: t('intelligence.topic.budgetsGoals') },
      { id: 'recurring_loans', label: t('intelligence.topic.recurringLoans') },
    ],
    [t, allPrompts.length]
  );

  const isBusy = Boolean(thinkingMsgId);

  return (
    <div className="max-w-5xl mx-auto w-full flex flex-col h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-4rem)] gap-4">
      {/* Compact Glass Header */}
      <header className="glass-card shrink-0 rounded-3xl px-5 py-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="bg-dynamic-accent-soft border-dynamic-accent text-dynamic-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white truncate">
              {t('nav.intelligence')}
            </h1>
            <div className="mt-0.5 flex items-center gap-2 text-[12px] sm:text-[13px] text-[#B8B8BE]">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="bg-dynamic-accent absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-dynamic-accent relative inline-flex h-2 w-2 rounded-full" />
              </span>
              <span className="truncate">{t('intelligence.statusBadge')}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={initWelcome}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
        >
          <RotateCcw className="h-4 w-4 text-dynamic-accent" />
          <span className="hidden sm:inline">{t('intelligence.newChat')}</span>
        </button>
      </header>

      {/* Scrollable Message Feed */}
      <div
        ref={feedRef}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-4"
      >
        {messages.map((msg) => (
          <ChatMessageBubble
            key={msg.id}
            message={msg}
            isThinking={thinkingMsgId === msg.id}
            isStreaming={streamingMsgId === msg.id}
            displayedText={streamingMsgId === msg.id ? streamedText : undefined}
            onSkipStream={streamingMsgId === msg.id ? handleSkipStream : undefined}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* Bottom Guided Prompt Dock (Zero Free-Text Input) */}
      <footer className="glass-card shrink-0 rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-[#B8B8BE]">
            {t('intelligence.suggestedLabel')}
          </span>
          <button
            type="button"
            onClick={() => setShowAllPrompts((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-dynamic-accent hover:bg-dynamic-accent-subtle transition-colors"
          >
            <span>
              {showAllPrompts ? t('intelligence.hideAll') : t('intelligence.allQuestions')}
            </span>
            {showAllPrompts ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {followUpPrompts.map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              disabled={isBusy}
              onClick={() => handleSelectPrompt(prompt.id)}
              className="min-h-[40px] rounded-xl border border-dynamic-accent/40 bg-dynamic-accent-subtle px-3.5 py-2 text-left text-[13px] font-medium text-white hover:bg-dynamic-accent-soft hover:border-dynamic-accent active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {prompt.label}
            </button>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {showAllPrompts && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
                {/* Topic Filter Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {topicTabs.map((tab) => {
                    const active = activeTopic === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTopic(tab.id)}
                        className={`rounded-full px-3 py-1 text-[12px] font-medium transition-all ${
                          active
                            ? 'bg-dynamic-accent-soft border border-dynamic-accent text-dynamic-accent'
                            : 'border border-white/[0.08] bg-white/[0.03] text-[#B8B8BE] hover:text-white hover:bg-white/[0.07]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Topic-Filtered Questions */}
                <div className="max-h-48 overflow-y-auto custom-scrollbar pr-1 flex flex-wrap gap-2">
                  {filteredDrawerPrompts.map((prompt) => (
                    <button
                      key={prompt.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSelectPrompt(prompt.id)}
                      className="min-h-[40px] rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-left text-[13px] font-medium text-[#E5E5EA] hover:bg-white/[0.08] hover:border-white/[0.18] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>
    </div>
  );
}

