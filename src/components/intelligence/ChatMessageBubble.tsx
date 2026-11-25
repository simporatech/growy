import { motion } from 'framer-motion';
import { ArrowUpRight, FastForward, Sparkles } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  IntelligenceActionLink,
  IntelligenceHighlight,
  IntelligenceTargetView,
} from '../../utils/intelligenceEngine';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  highlights?: IntelligenceHighlight[];
  actionLink?: IntelligenceActionLink;
  healthScore?: number;
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isThinking?: boolean;
  isStreaming?: boolean;
  displayedText?: string;
  onSkipStream?: () => void;
  onNavigate?: (targetTab: IntelligenceTargetView) => void;
}

export function ChatMessageBubble({
  message,
  isThinking = false,
  isStreaming = false,
  displayedText,
  onSkipStream,
  onNavigate,
}: ChatMessageBubbleProps) {
  const { t } = useLanguage();

  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="flex justify-end"
      >
        <div className="bg-dynamic-accent-soft border-dynamic-accent max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md border px-4 py-3 text-sm font-medium text-white shadow-sm">
          {message.text}
        </div>
      </motion.div>
    );
  }

  const visibleText = isStreaming ? (displayedText ?? '') : message.text;
  const showExtras = !isThinking && !isStreaming;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className="flex items-start gap-3"
    >
      {/* Growy Avatar */}
      <div className="bg-dynamic-accent-soft border-dynamic-accent text-dynamic-accent mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>

      {/* Assistant Glass Card */}
      <div className="glass-card min-w-0 flex-1 max-w-[92%] sm:max-w-[84%] rounded-2xl rounded-tl-md p-4 sm:p-5 space-y-3.5">
        {isThinking ? (
          <div className="flex items-center gap-2.5 text-sm text-[#B8B8BE]">
            <div className="flex items-center gap-1" aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <motion.span
                  key={dot}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: dot * 0.16,
                    ease: 'easeInOut',
                  }}
                  className="bg-dynamic-accent h-1.5 w-1.5 rounded-full"
                />
              ))}
            </div>
            <span>{t('intelligence.analyzing')}</span>
          </div>
        ) : (
          <>
            {typeof message.healthScore === 'number' && showExtras && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-dynamic-accent bg-dynamic-accent-subtle px-3 py-1 text-xs font-semibold text-dynamic-accent"
              >
                <span>{t('intelligence.healthScore')}:</span>
                <span className="font-display tabular-nums">{message.healthScore}/100</span>
              </motion.div>
            )}

            <div className="whitespace-pre-line text-sm leading-relaxed text-white/95">
              {visibleText}
              {isStreaming && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                  className="text-dynamic-accent ml-0.5 inline-block font-bold"
                  aria-hidden="true"
                >
                  |
                </motion.span>
              )}
            </div>

            {isStreaming && onSkipStream && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onSkipStream}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[12px] font-medium text-[#B8B8BE] hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  <FastForward className="h-3 w-3" />
                  <span>{t('intelligence.skipAnimation')}</span>
                </button>
              </div>
            )}

            {showExtras && message.highlights && message.highlights.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1"
              >
                {message.highlights.map((item, idx) => {
                  const toneColor =
                    item.tone === 'accent'
                      ? 'text-dynamic-accent'
                      : item.tone === 'coral'
                        ? 'text-coral'
                        : 'text-white';
                  return (
                    <div
                      key={`${item.label}-${idx}`}
                      className="rounded-xl border border-white/[0.08] bg-black/25 px-3.5 py-2.5"
                    >
                      <p className="truncate text-[12px] text-[#B8B8BE]">{item.label}</p>
                      <p
                        className={`mt-0.5 truncate font-display text-sm sm:text-base font-semibold tabular-nums ${toneColor}`}
                      >
                        {item.value}
                      </p>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {showExtras && message.actionLink && onNavigate && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="pt-0.5"
              >
                <button
                  type="button"
                  onClick={() => onNavigate(message.actionLink!.targetTab)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-dynamic-accent bg-dynamic-accent-subtle px-3.5 text-[13px] font-medium text-dynamic-accent hover:bg-dynamic-accent-soft active:scale-[0.98] transition-all"
                >
                  <span>{message.actionLink.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

