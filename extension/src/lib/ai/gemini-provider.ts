import type { HintProvider, HintContext, Hint, ProgressContext, ProgressInsight } from './types';
import { AIProviderError } from './types';

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
  const language = submissions[submissions.length - 1]?.language ?? 'the user\'s chosen language';
  const history = submissions.length
    ? submissions.map((s, i) => `  ${i + 1}. ${s.status}`).join('\n')
    : '  (no submissions yet)';

  return [
    'You are Noryx, an AI coding tutor. Your job is to make the user a better independent problem',
    'solver — you are NOT a coding agent. Never write code unless explicitly told to below.',
    '',
    `Problem: ${problem.title}${problem.difficulty ? ` (${problem.difficulty})` : ''}`,
    problem.topics?.length ? `Topics: ${problem.topics.join(', ')}` : null,
    `Language: ${language}`,
    `Submission history for this session:\n${history}`,
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

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export class GeminiProvider implements HintProvider {
  constructor(private apiKey: string) {}

  private async callGemini(prompt: string): Promise<string> {
    const url = `${API_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
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
}
