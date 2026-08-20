import { useState, type KeyboardEvent } from 'react';
import { addHint, updateSessionHintState } from '../storage';
import { GeminiProvider } from '../ai/gemini-provider';
import { MAX_AUTO_HINT_LEVEL } from '../ai/intervention';
import { AIProviderError } from '../ai/types';
import type { CodingSession, StoredSubmission, HintLevel, Problem, ProblemMetadata } from '../types';

export interface CoachTarget {
  session: CodingSession;
  problem: Problem & ProblemMetadata;
  submissions: StoredSubmission[];
}

/** Shared hint-request plumbing between the dashboard's CoachPanel and the in-page overlay —
 *  both let the user ask for a leveled hint or type a free-text question to Gemini. Only how they
 *  resolve *which* session to coach (search vs. a fixed problemKey) and how they render differ,
 *  so that stays in each caller; this hook is just the part that's actually identical. */
export function useCoach(apiKey: string | null, active: CoachTarget | null, onDone: () => void) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextLevel = Math.min((active?.session.hintLevel ?? 0) + 1, MAX_AUTO_HINT_LEVEL) as HintLevel;

  async function requestHint(level: HintLevel | 'solution') {
    if (!apiKey || !active) return;
    const userMessage = question.trim() || undefined;
    setBusy(true);
    setError(null);
    setQuestion('');
    try {
      const provider = new GeminiProvider(apiKey);
      const hint = await provider.generateHint({
        problem: active.problem,
        session: active.session,
        submissions: active.submissions,
        level,
        userMessage,
      });
      const now = Date.now();
      await addHint({
        sessionId: active.session.id,
        level: hint.level,
        text: hint.text,
        createdAt: now,
        auto: false,
        userMessage,
      });
      if (level !== 'solution') await updateSessionHintState(active.session.id, level, now);
      onDone();
    } catch (err) {
      setError(err instanceof AIProviderError ? err.message : 'Something went wrong asking for a hint.');
    } finally {
      setBusy(false);
    }
  }

  function handleComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!busy) void requestHint(nextLevel);
    }
  }

  function handleShowSolution() {
    const confirmed = window.confirm(
      'Viewing the full solution will affect your learning for this problem. Are you sure?',
    );
    if (confirmed) void requestHint('solution');
  }

  return { question, setQuestion, busy, error, nextLevel, requestHint, handleComposerKeyDown, handleShowSolution };
}
