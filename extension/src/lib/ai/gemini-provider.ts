import type {
  HintProvider,
  HintContext,
  Hint,
  ProgressContext,
  ProgressInsight,
  InterviewContext,
  GeneratedPracticeProblem,
} from './types';
import { AIProviderError } from './types';
import type { InterviewEvaluation } from '../types';

// Gemini Flash-Lite class model per the PRD's "free-tier access" requirement. Verified live
// against the real API (2026-08-20) — gemini-2.0-flash-lite has since been retired; Google's own
// 404 response pointed to this replacement. Bump again if it's retired in turn.
const MODEL = 'gemini-3.5-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const LEVEL_INSTRUCTIONS: Record<HintContext['level'], string> = {
  1: 'Ask exactly one short Socratic question that nudges the user toward the key insight, without naming the technique or algorithm. Do not write any code.',
  2: 'Give one small directional hint about the kind of data structure or technique that might help, without naming the specific pattern outright. Do not write any code.',
  3: "Name the relevant algorithmic pattern or technique clearly (e.g. \"this is a sliding-window problem\"), but don't explain how to implement it. Do not write any code.",
  4: 'Explain the complete algorithmic approach in plain language — what to do and why it works — but do not write any code.',
  solution: 'Write a complete, correct solution in the language given below, with a brief explanation of the approach above the code.',
};

function buildPrompt(context: HintContext): string {
  const { problem, submissions, level, userMessage } = context;
  const latest = submissions[submissions.length - 1];
  const language = latest?.language ?? 'the user\'s chosen language';
  const history = submissions.length
    ? submissions.map((s, i) => `  ${i + 1}. ${s.status}`).join('\n')
    : '  (no submissions yet)';
  // Only present when the user opted into code capture (settings.captureCode) — see
  // EditorState.code. Without it, hints stay status-based, same as before this existed.
  const code = latest?.code;

  return [
    'You are Noryx, an AI coding tutor. Your job is to make the user a better independent problem',
    'solver — you are NOT a coding agent. Never write code unless explicitly told to below.',
    '',
    `Problem: ${problem.title}${problem.difficulty ? ` (${problem.difficulty})` : ''}`,
    problem.topics?.length ? `Topics: ${problem.topics.join(', ')}` : null,
    `Language: ${language}`,
    `Submission history for this session:\n${history}`,
    code
      ? `\nThe user's most recently submitted code — ground your feedback in this specifically ` +
        `(reference actual lines/logic, don't guess at what the bug might be) — but never rewrite, ` +
        `complete, or fix it yourself unless explicitly asked for the solution:\n\`\`\`${language}\n${code}\n\`\`\``
      : null,
    '',
    userMessage
      ? `The user says: "${userMessage}"\nRespond to what they said, while staying within this constraint: ${LEVEL_INSTRUCTIONS[level]}`
      : `Task: ${LEVEL_INSTRUCTIONS[level]}`,
    'Keep the response under 80 words unless writing a solution.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

function buildRoadmapPrompt(context: ProgressContext): string {
  const { totalSolved, totalAttempted, successRate, platformCounts, difficultyCounts, topicCounts } = context;

  const formatCounts = (counts: Record<string, number>) =>
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, n]) => `${label}: ${n}`)
      .join(', ') || '(none tracked)';

  return [
    'You are Noryx, an AI coding tutor building a short personalized DSA practice roadmap for this',
    'user, based only on the real activity below — never invent specific problems or stats not',
    'given here. If the history is thin, say so plainly and lean on general beginner-appropriate',
    "progression advice instead of pretending to see patterns that aren't really there.",
    '',
    `Problems solved: ${totalSolved} / ${totalAttempted} attempted (${successRate}% success rate)`,
    `Platforms: ${formatCounts(platformCounts)}`,
    `Difficulty labels seen (raw, per-platform — scales aren't comparable across platforms): ${formatCounts(difficultyCounts)}`,
    `Topics seen (often sparse — most platforms don't expose this pre-solve): ${formatCounts(topicCounts)}`,
    '',
    'Task: write a short roadmap — 3 to 5 concrete focus areas or next steps, each one sentence,',
    "as a plain list. End with one sentence of encouragement. Keep the whole thing under 150 words.",
    'Never write code.',
  ].join('\n');
}

const INTERVIEWER_ROLE =
  'You are Noryx, roleplaying as a friendly-but-real technical interviewer. Never write or fix ' +
  "code, never reveal the algorithm outright — a real interviewer wouldn't. Keep every message " +
  'short (2-3 sentences max) and conversational, like real interview dialogue.';

function buildInterviewOpenerPrompt(problem: InterviewContext['problem']): string {
  return [
    INTERVIEWER_ROLE,
    '',
    `Problem: ${problem.title}${problem.difficulty ? ` (${problem.difficulty})` : ''}`,
    problem.topics?.length ? `Topics: ${problem.topics.join(', ')}` : null,
    '',
    'This is the opening of the interview. Greet the candidate briefly, then ask ONE genuine',
    'clarifying question a real interviewer would ask about this problem (e.g. input constraints,',
    'edge cases, expected behavior) — not a hint toward the solution.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

function buildInterviewContinuePrompt(context: InterviewContext): string {
  const { problem, turns, submissions } = context;
  const transcript = turns.map((t) => `${t.role}: ${t.text}`).join('\n');
  const history = submissions.length
    ? submissions.map((s, i) => `  ${i + 1}. ${s.status}`).join('\n')
    : '  (no submissions yet)';

  return [
    INTERVIEWER_ROLE,
    '',
    `Problem: ${problem.title}${problem.difficulty ? ` (${problem.difficulty})` : ''}`,
    `Submissions so far:\n${history}`,
    '',
    `Transcript so far:\n${transcript}`,
    '',
    "Respond to the candidate's last message as the interviewer would: ask a probing follow-up",
    '(about complexity, edge cases, or their reasoning), or a brief acknowledgment plus the next',
    "clarifying question if they haven't started explaining an approach yet. Never give away the",
    'pattern or algorithm.',
  ].join('\n');
}

function buildInterviewEvalPrompt(context: InterviewContext): string {
  const { problem, turns, submissions, elapsedMs } = context;
  const transcript = turns.map((t) => `${t.role}: ${t.text}`).join('\n') || '(no dialogue)';
  const minutes = Math.round(elapsedMs / 60000);
  const solved = submissions.some((s) => s.status === 'Accepted');

  return [
    'You are Noryx, evaluating a completed mock technical interview. Score honestly based only on',
    'the transcript and outcome below — never invent details not present here.',
    '',
    `Problem: ${problem.title}${problem.difficulty ? ` (${problem.difficulty})` : ''}`,
    `Time spent: ${minutes} minutes`,
    `Solved: ${solved ? 'yes' : 'no'}`,
    `Transcript:\n${transcript}`,
    '',
    'Respond with ONLY a JSON object, no markdown fences, no other text, in exactly this shape:',
    '{"communication": <1-5 int>, "problemSolving": <1-5 int>, "complexityAwareness": <1-5 int>, "summary": "<2-3 sentence honest summary>"}',
  ].join('\n');
}

function buildPracticeProblemPrompt(topic: string, difficulty: string): string {
  return [
    'You are Noryx, generating an original DSA practice problem (not a copy of a known',
    "LeetCode/Codeforces/etc. problem) for a user practicing a specific topic.",
    '',
    `Topic focus: ${topic}`,
    `Target difficulty: ${difficulty}`,
    '',
    'Respond with ONLY a JSON object, no markdown fences, no other text, in exactly this shape:',
    '{"title": "...", "statement": "self-contained problem description in plain English, ' +
      'including the function signature, input/output format, and constraints", ' +
      `"difficulty": "${difficulty}", "topics": ["..."], "functionName": "camelCaseName", ` +
      '"testCases": [{"args": [<json values matching the function parameters in order>], ' +
      '"expected": <json value>}, ... 4 to 6 cases including at least one edge case], ' +
      '"referenceSolutionJS": "a single complete correct JavaScript function declaration named ' +
      'exactly functionName that solves it — no explanation, no markdown fences, no other code"}',
  ].join('\n');
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export class GeminiProvider implements HintProvider {
  constructor(private apiKey: string) {}

  private async callGemini(prompt: string, jsonMode = false): Promise<string> {
    const url = `${API_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          ...(jsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
        }),
      });
    } catch {
      throw new AIProviderError("Couldn't reach Gemini — check your internet connection.");
    }

    if (response.status === 401 || response.status === 403) {
      throw new AIProviderError("Gemini rejected the API key — check it in Noryx's settings.");
    }
    if (response.status === 429) {
      throw new AIProviderError('Gemini rate limit hit — try again in a bit.');
    }
    if (!response.ok) {
      throw new AIProviderError(`Gemini request failed (${response.status}).`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      throw new AIProviderError('Gemini returned an empty response — try again.');
    }
    return text;
  }

  async generateHint(context: HintContext): Promise<Hint> {
    const text = await this.callGemini(buildPrompt(context));
    return { level: context.level, text };
  }

  async analyzeProgress(context: ProgressContext): Promise<ProgressInsight> {
    const text = await this.callGemini(buildRoadmapPrompt(context));
    return { text, generatedAt: Date.now() };
  }

  async startInterview(problem: InterviewContext['problem']): Promise<string> {
    return this.callGemini(buildInterviewOpenerPrompt(problem));
  }

  async continueInterview(context: InterviewContext): Promise<string> {
    return this.callGemini(buildInterviewContinuePrompt(context));
  }

  async evaluateInterview(context: InterviewContext): Promise<InterviewEvaluation> {
    const raw = await this.callGemini(buildInterviewEvalPrompt(context), true);
    try {
      const parsed = JSON.parse(raw) as Partial<InterviewEvaluation>;
      const clamp = (n: unknown) => Math.min(5, Math.max(1, Math.round(Number(n) || 3)));
      return {
        communication: clamp(parsed.communication),
        problemSolving: clamp(parsed.problemSolving),
        complexityAwareness: clamp(parsed.complexityAwareness),
        summary: typeof parsed.summary === 'string' && parsed.summary ? parsed.summary : 'No summary returned.',
      };
    } catch {
      // Conservative-by-design, same as maybeIntervene: a malformed response shouldn't crash the
      // flow, just degrade to an honest "couldn't score this" rather than fabricated numbers.
      throw new AIProviderError("Gemini's evaluation wasn't in the expected format — try again.");
    }
  }

  async generatePracticeProblem(topic: string, difficulty: string): Promise<GeneratedPracticeProblem> {
    const raw = await this.callGemini(buildPracticeProblemPrompt(topic, difficulty), true);
    let parsed: Partial<GeneratedPracticeProblem>;
    try {
      parsed = JSON.parse(raw) as Partial<GeneratedPracticeProblem>;
    } catch {
      throw new AIProviderError("Gemini's problem generation wasn't valid JSON — try again.");
    }
    if (
      typeof parsed.title !== 'string' ||
      typeof parsed.statement !== 'string' ||
      typeof parsed.functionName !== 'string' ||
      typeof parsed.referenceSolutionJS !== 'string' ||
      !Array.isArray(parsed.testCases) ||
      parsed.testCases.length === 0
    ) {
      throw new AIProviderError("Gemini's problem generation wasn't in the expected format — try again.");
    }
    return {
      title: parsed.title,
      statement: parsed.statement,
      difficulty: typeof parsed.difficulty === 'string' ? parsed.difficulty : difficulty,
      topics: Array.isArray(parsed.topics) ? parsed.topics.filter((t): t is string => typeof t === 'string') : [topic],
      functionName: parsed.functionName,
      testCases: parsed.testCases,
      referenceSolutionJS: parsed.referenceSolutionJS,
    };
  }
}
