import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../../lib/settings';
import { enablePublicProfile, disablePublicProfile, shareUrlFor } from '../../lib/publicProfile';

export default function Settings() {
  const [keyInput, setKeyInput] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [captureCode, setCaptureCode] = useState(false);

  useEffect(() => {
    void getSettings().then((s) => {
      setSavedKey(s.geminiApiKey ?? null);
      setShareUrl(s.publicProfile ? shareUrlFor(s.publicProfile.id) : null);
      setCaptureCode(!!s.captureCode);
    });
  }, []);

  async function handleToggleCaptureCode() {
    const next = !captureCode;
    await saveSettings({ captureCode: next });
    setCaptureCode(next);
  }

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
    setShareUrl(null);
  }

  async function handleEnableProfile() {
    setProfileBusy(true);
    setProfileError(null);
    try {
      setShareUrl(await enablePublicProfile());
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Something went wrong enabling the public profile.');
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleDisableProfile() {
    const confirmed = window.confirm('This deletes your public profile — the link will stop working. Continue?');
    if (!confirmed) return;
    setProfileBusy(true);
    setProfileError(null);
    try {
      await disablePublicProfile();
      setShareUrl(null);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Something went wrong disabling the public profile.');
    } finally {
      setProfileBusy(false);
    }
  }

  function handleCopy() {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface">🔗 Public profile</h3>
        <p className="text-on-surface-variant text-sm">
          Get a shareable link — for a resume or portfolio — showing your problems solved, streak,
          success rate, and platform mix. Updates automatically as you solve. Only those aggregate
          numbers are ever sent; never individual problems, code, or timestamps. No login for you
          or whoever you share it with — knowing the link is what grants access, the same as a
          Gist.
        </p>
        {profileError && <p className="text-error text-sm">{profileError}</p>}
        {shareUrl ? (
          <>
            <div className="flex gap-xs flex-wrap items-center">
              <code className="flex-1 min-w-[200px] bg-surface-container border border-white/10 text-electric-blue rounded-lg px-sm py-xs text-sm truncate">
                {shareUrl}
              </code>
              <button
                onClick={handleCopy}
                className="bg-surface-container border border-electric-blue/30 text-electric-blue font-label-sm rounded-lg px-sm py-xs text-sm"
              >
                {copied ? '✅ Copied' : 'Copy'}
              </button>
            </div>
            <button
              disabled={profileBusy}
              onClick={() => void handleDisableProfile()}
              className="self-start bg-surface-container border border-error/30 text-error font-label-sm rounded-lg px-sm py-xs text-sm disabled:opacity-50"
            >
              {profileBusy ? 'Removing…' : 'Disable public profile'}
            </button>
          </>
        ) : (
          <button
            disabled={profileBusy}
            onClick={() => void handleEnableProfile()}
            className="self-start bg-gradient-to-r from-electric-blue to-soft-violet text-on-primary font-label-sm rounded-lg px-sm py-xs text-sm disabled:opacity-50"
          >
            {profileBusy ? 'Enabling…' : '✨ Enable public profile'}
          </button>
        )}
      </div>

      <div className="glass-card rounded-xl p-sm flex flex-col gap-xs">
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface">// code_analysis</h3>
        <p className="text-on-surface-variant text-sm">
          Off by default: Noryx only sees your submission's status ("Wrong Answer"), never the
          code. Turn this on and it can read your editor's code when you submit, so hints get
          grounded in what you actually wrote instead of generic status-based nudges. That code
          goes to Gemini (same boundary as the API key above) and is stored locally alongside the
          submission — nowhere else, and never for the public profile.
        </p>
        <button
          onClick={() => void handleToggleCaptureCode()}
          className={
            captureCode
              ? 'self-start bg-electric-blue/10 border border-electric-blue/40 text-electric-blue font-code-md text-xs py-2 px-4 uppercase transition-all'
              : 'self-start bg-transparent border border-white/10 text-on-surface-variant font-code-md text-xs py-2 px-4 uppercase hover:border-white/30 transition-all'
          }
        >
          {captureCode ? '✓ enabled — click to disable' : 'enable code analysis'}
        </button>
      </div>

      <div className="glass-card rounded-xl p-sm flex flex-col gap-xs">
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface">Local data</h3>
        <p className="text-on-surface-variant text-sm">
          Everything Noryx tracks — problems, sessions, submissions, hints — lives only in this
          browser's local storage. It's never sent anywhere except: the aggregate counts synced
          for the public profile above (if enabled), and your code going to Gemini for hint
          generation (only if code analysis above is enabled).
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
