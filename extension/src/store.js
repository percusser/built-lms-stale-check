export async function read(key, fallback) {
  const got = await chrome.storage.local.get(key);
  return got[key] ?? fallback;
}

export async function write(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function update(key, fallback, fn) {
  const next = fn(await read(key, fallback));
  await write(key, next);
  return next;
}
