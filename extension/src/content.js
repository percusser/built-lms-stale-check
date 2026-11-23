function snapshot() {
  return { url: location.href, title: document.title, text: document.body.innerText };
}

chrome.runtime.sendMessage({ type: 'page-text', ...snapshot() }).catch(() => {});

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type === 'get-page-text') reply(snapshot());
});
