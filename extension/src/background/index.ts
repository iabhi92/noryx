import { upsertProblem, getOrCreateSession, applyHeartbeat, recordSubmission } from '../lib/storage';
import { problemKey } from '../lib/types';
import type { RuntimeMessage } from '../lib/messages';

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  void handleMessage(message);
});

async function handleMessage(message: RuntimeMessage): Promise<void> {
  switch (message.type) {
    case 'SESSION_START': {
      const key = problemKey(message.problem.platform, message.problem.externalId);
      await upsertProblem(key, message.problem);
      await getOrCreateSession(key);
      break;
    }
    case 'HEARTBEAT':
      await applyHeartbeat(message.problemKey, message.activeDeltaMs, message.idleDeltaMs, message.tabSwitchInc);
      break;
    case 'SUBMISSION':
      await recordSubmission(message.problemKey, message.submission);
      break;
  }
}

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
});
