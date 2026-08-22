const SETTINGS_KEY = 'meowmentor:settings';

export interface MeowMentorSettings {
  geminiApiKey?: string;
  publicProfile?: { id: string; writeToken: string };
  // Opt-in, default off: lets the content script read your editor's code so the AI coach can give
  // feedback grounded in what you actually wrote, not just a submission status. That code goes to
  // Gemini for hint generation and is stored locally with the submission — same "sent only to
  // Google's API" boundary as the Gemini key itself, never sent anywhere else.
  captureCode?: boolean;
}

export async function getSettings(): Promise<MeowMentorSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return (result[SETTINGS_KEY] as MeowMentorSettings) ?? {};
}

export async function saveSettings(settings: MeowMentorSettings): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...settings } });
}
