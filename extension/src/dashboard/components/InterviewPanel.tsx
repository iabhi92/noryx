import { useCallback, useEffect, useRef, useState } from 'react';
import { getInterview, appendInterviewTurn, saveInterviewEvaluation } from '../../lib/storage';
import { GeminiProvider } from '../../lib/ai/gemini-provider';
import { AIProviderError } from '../../lib/ai/types';
import { CircularTimer } from '../../lib/CircularTimer';
import type { CoachTarget } from '../../lib/hooks/useCoach';
import type { InterviewTurn, InterviewEvaluation } from '../../lib/types';

interface InterviewPanelProps {
  apiKey: string;
  active: CoachTarget;
  onExit: () => void;
}

const SCORE_LABEL: Record<'communication' | 'problemSolving' | 'complexityAwareness', string> = {
  communication: 'Communication',
  problemSolving: 'Problem Solving',
  complexityAwareness: 'Complexity Awareness',
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-on-surface-variant mb-1">
        <span className="uppercase tracking-wide font-code-md">{label}</span>
        <span className="text-electric-blue font-code-md">{value}/5</span>
      </div>
      <div className="w-full bg-surface-container-highest h-1.5">
        <div
          className="h-full bg-electric-blue"
          style={{ width: `${(value / 5) * 100}%`, boxShadow: '0 0 8px rgba(0,240,255,0.6)' }}
        />
      </div>
    </div>
  );
}

export default function InterviewPanel({ apiKey, active, onExit }: InterviewPanelProps) {
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const provider = useRef(new GeminiProvider(apiKey)).current;

  const start = useCallback(async () => {
    const existing = await getInterview(active.session.id);
    if (existing) {
      setTurns(existing.turns);
      setEvaluation(existing.evaluation ?? null);
      setLoaded(true);
      return;
    }
    setBusy(true);
    try {
      const opener = await provider.startInterview(active.problem);
      const stored = await appendInterviewTurn(active.session.id, { role: 'interviewer', text: opener, at: Date.now() });
      setTurns(stored.turns);
    } catch (err) {
      setError(err instanceof AIProviderError ? err.message : 'Could not start the interview.');
    } finally {
      setBusy(false);
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  async function handleSend() {
    const text = reply.trim();
    if (!text || busy) return;
    setReply('');
    setBusy(true);
    setError(null);
    try {
      const afterCandidate = await appendInterviewTurn(active.session.id, { role: 'candidate', text, at: Date.now() });
      setTurns(afterCandidate.turns);
      const response = await provider.continueInterview({
        problem: active.problem,
        turns: afterCandidate.turns,
        submissions: active.submissions,
        elapsedMs: active.session.activeMs,
      });
      const afterInterviewer = await appendInterviewTurn(active.session.id, {
        role: 'interviewer',
        text: response,
        at: Date.now(),
      });
      setTurns(afterInterviewer.turns);
    } catch (err) {
      setError(err instanceof AIProviderError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEndInterview() {
    setBusy(true);
    setError(null);
    try {
      const result = await provider.evaluateInterview({
        problem: active.problem,
        turns,
        submissions: active.submissions,
        elapsedMs: active.session.activeMs,
      });
      await saveInterviewEvaluation(active.session.id, result);
      setEvaluation(result);
    } catch (err) {
      setError(err instanceof AIProviderError ? err.message : 'Could not score this interview.');
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="glass-card rounded-xl p-sm mb-md flex flex-col gap-sm">
      <div className="flex items-center justify-between gap-sm border-b border-white/5 pb-sm">
        <h3 className="font-code-md text-lg text-on-surface tracking-tight uppercase flex items-center gap-2">
          <span className="text-electric-blue opacity-70">#</span> mock_interview — {active.problem.title}
        </h3>
        <div className="flex items-center gap-sm">
          <CircularTimer elapsedMs={active.session.activeMs} isLive size={48} />
          <button onClick={onExit} className="close-btn text-on-surface-variant hover:text-on-surface text-sm font-code-md">
            exit
          </button>
        </div>
      </div>

      {evaluation ? (
        <div className="flex flex-col gap-sm">
          <div className="flex flex-col gap-sm">
            <ScoreBar label={SCORE_LABEL.communication} value={evaluation.communication} />
            <ScoreBar label={SCORE_LABEL.problemSolving} value={evaluation.problemSolving} />
            <ScoreBar label={SCORE_LABEL.complexityAwareness} value={evaluation.complexityAwareness} />
          </div>
          <div className="chat-block-agent">
            <span className="msg-label text-electric-blue text-[10px] uppercase tracking-wide block mb-1">
              coach.noryx // feedback
            </span>
            <p className="text-on-surface/90 text-sm leading-relaxed">{evaluation.summary}</p>
          </div>
        </div>
      ) : (
        <>
          <div ref={chatRef} className="flex flex-col gap-4 max-h-[60vh] min-h-[16rem] overflow-y-auto pr-1 font-code-md text-sm">
            {turns.map((t, i) => (
              <div key={i} className={t.role === 'interviewer' ? 'chat-block-agent' : 'chat-block-user'}>
                <div className="text-[10px] mb-1 uppercase tracking-wider opacity-80 text-electric-blue">
                  {t.role === 'interviewer' ? 'interviewer' : 'you'}
                </div>
                <p className="text-on-surface/90 leading-relaxed whitespace-pre-wrap">{t.text}</p>
              </div>
            ))}
            {busy && <div className="chat-block-agent text-on-surface-variant text-xs">thinking…</div>}
          </div>

          {error && <p className="text-error text-sm font-code-md">{error}</p>}

          <div
            className={`relative flex items-center glass-card border border-white/10 rounded focus-within:border-electric-blue/40 transition-colors ${busy ? '' : 'composer-pulse'}`}
          >
            <span className="absolute left-4 text-electric-blue font-code-md text-sm font-bold opacity-80">&gt;_</span>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="talk through your approach…"
              rows={1}
              className="w-full bg-transparent border-none py-3 pl-12 pr-4 text-on-surface font-code-md text-sm outline-none resize-none placeholder:text-on-surface-variant/40"
            />
          </div>

          <button
            disabled={busy}
            onClick={() => void handleEndInterview()}
            className="self-start bg-transparent border border-white/10 text-on-surface-variant font-code-md text-xs py-2 px-4 uppercase disabled:opacity-50 hover:text-on-surface hover:border-white/30 transition-all"
          >
            end interview &amp; get feedback
          </button>
        </>
      )}
    </div>
  );
}
