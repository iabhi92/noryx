import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../../lib/settings';

export default function Settings() {
  const [keyInput, setKeyInput] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    void getSettings().then((s) => setSavedKey(s.geminiApiKey ?? null));
  }, []);

  async function handleSaveKey() {
    if (!keyInput.trim()) return;
    await saveSettings({ geminiApiKey: keyInput.trim() });
    setSavedKey(keyInput.trim());
    setKeyInput('');
  }

  async function handleClearData() {
    const confirmed = window.confirm(
      'This deletes every problem, session, submission, and hint Noryx has tracked locally. This cannot be undone. Continue?',
    );
    if (!confirmed) return;
    await chrome.storage.local.clear();
    setCleared(true);
    setSavedKey(null);
  }

  return (
    <div className="flex flex-col gap-md max-w-xl">
      <div className="glass-card rounded-xl p-sm flex flex-col gap-xs">
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface">Gemini API key</h3>
        <p className="text-on-surface-variant text-sm">
          Noryx nudges you with hints while you're stuck — it needs a free Gemini API key to do
          that. Stored locally in your browser, sent only to Google's API.
        </p>
        {savedKey && (
          <p className="text-sm text-on-surface-variant">
            Current key: <span className="font-mono">{'•'.repeat(8)}{savedKey.slice(-4)}</span>
          </p>
        )}
        <div className="flex gap-xs flex-wrap">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Gemini API key"
            className="flex-1 min-w-[200px] bg-surface-container border border-white/10 text-on-surface rounded-lg px-sm py-xs text-sm outline-none focus:border-electric-blue"
          />
          <button
            onClick={() => void handleSaveKey()}
            className="bg-gradient-to-r from-electric-blue to-soft-violet text-on-primary font-label-sm rounded-lg px-sm py-xs text-sm"
          >
            Save
          </button>
        </div>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-electric-blue text-sm"
        >
          Get a free key →
        </a>
      </div>

      <div className="glass-card rounded-xl p-sm flex flex-col gap-xs">
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface">Local data</h3>
        <p className="text-on-surface-variant text-sm">
          Everything Noryx tracks — problems, sessions, submissions, hints — lives only in this
          browser's local storage. Nothing is synced to a server.
        </p>
        <button
          onClick={() => void handleClearData()}
          className="self-start bg-surface-container border border-error/30 text-error font-label-sm rounded-lg px-sm py-xs text-sm"
        >
          Delete all local data
        </button>
        {cleared && <p className="text-sm text-on-surface-variant">Cleared.</p>}
      </div>
    </div>
  );
}
