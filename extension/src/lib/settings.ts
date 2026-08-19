const SETTINGS_KEY = 'noryx:settings';

export interface NoryxSettings {
  geminiApiKey?: string;
}

export async function getSettings(): Promise<NoryxSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return (result[SETTINGS_KEY] as NoryxSettings) ?? {};
}

export async function saveSettings(settings: NoryxSettings): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...settings } });
}
