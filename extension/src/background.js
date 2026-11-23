import { hashText } from '@stale-check/shared';
import { factsForUrl, pageKey } from './facts.js';
import { update } from './store.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

async function onPageText({ url, title, text }, tabId) {
  if (factsForUrl(url).length === 0) return;
  const key = pageKey(url);
  const hash = await hashText(text);
  const pages = await update('pages', {}, (all) => ({
    ...all,
    [key]: { ...all[key], url: key, title, hash, seenAt: Date.now() },
  }));
  const needsCheck = pages[key].checkedHash !== hash;
  if (tabId !== undefined) {
    await chrome.action.setBadgeText({ tabId, text: needsCheck ? '!' : '' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#b45309' });
  }
  chrome.runtime.sendMessage({ type: 'page-seen', url: key }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'page-text') onPageText(message, sender.tab?.id);
  if (message?.type === 'page-checked' && message.tabId !== undefined) {
    chrome.action.setBadgeText({ tabId: message.tabId, text: '' }).catch(() => {});
  }
});
