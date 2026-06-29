const DEFAULT_NOTEBOOKS = ['General', 'Code', 'Writing', 'Research', 'Ideas'];

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: 'clip-response',
    title: 'Clip to AIClip',
    contexts: ['selection']
  });

  if (details.reason === 'install') {
    chrome.storage.sync.get('aiclip', (res) => {
      if (!res.aiclip) {
        chrome.storage.sync.set({
          aiclip: {
            clips: [],
            notebooks: DEFAULT_NOTEBOOKS,
            nextId: 1
          }
        });
      }
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'clip-response' && info.selectionText) {
    saveClip({
      content: info.selectionText.trim(),
      source: tab.url || '',
      sourceTitle: tab.title || '',
      notebook: 'General',
      tags: [],
      format: 'text'
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'SAVE_CLIP':
      saveClip(msg.data).then(sendResponse);
      return true;
    case 'GET_CLIPS':
      getClips(msg.filter).then(sendResponse);
      return true;
    case 'UPDATE_CLIP':
      updateClip(msg.id, msg.data).then(sendResponse);
      return true;
    case 'DELETE_CLIP':
      deleteClip(msg.id).then(sendResponse);
      return true;
    case 'GET_NOTEBOOKS':
      getNotebooks().then(sendResponse);
      return true;
    case 'ADD_NOTEBOOK':
      addNotebook(msg.name).then(sendResponse);
      return true;
    case 'DELETE_NOTEBOOK':
      deleteNotebook(msg.name).then(sendResponse);
      return true;
    case 'IMPORT_CLIPS':
      importClips(msg.data).then(sendResponse);
      return true;
    case 'EXPORT_CLIPS':
      exportClips().then(sendResponse);
      return true;
    case 'EXPORT_MARKDOWN':
      exportMarkdown(msg.filter).then(sendResponse);
      return true;
    case 'CLEAR_ALL':
      clearAll().then(sendResponse);
      return true;
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-clips') {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_CLIPS_OVERLAY' });
  }
});

function getStore() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('aiclip', (res) => {
      resolve(res.aiclip || { clips: [], notebooks: DEFAULT_NOTEBOOKS, nextId: 1 });
    });
  });
}

function setStore(data) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ aiclip: data }, resolve);
  });
}

async function saveClip(data) {
  const store = await getStore();
  const clip = {
    id: store.nextId++,
    content: data.content,
    title: data.title || data.content.slice(0, 80),
    notebook: data.notebook || 'General',
    tags: data.tags || [],
    source: data.source || '',
    sourceTitle: data.sourceTitle || '',
    format: data.format || 'text',
    clippedAt: Date.now(),
    favorite: false
  };
  store.clips.unshift(clip);

  if (getByteSizeEstimate(store) > 100000) {
    store.clips = store.clips.slice(0, 150);
  }

  await setStore(store);
  notifyUpdate();
  return { success: true, clip };
}

async function getClips(filter) {
  const store = await getStore();
  let clips = store.clips;

  if (filter) {
    if (filter.notebook && filter.notebook !== 'All') {
      clips = clips.filter((c) => c.notebook === filter.notebook);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      clips = clips.filter((c) =>
        c.content.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filter.tag) {
      clips = clips.filter((c) => c.tags.includes(filter.tag));
    }
    if (filter.favoritesOnly) {
      clips = clips.filter((c) => c.favorite);
    }
  }

  return { clips, notebooks: store.notebooks };
}

async function updateClip(id, data) {
  const store = await getStore();
  const idx = store.clips.findIndex((c) => c.id === id);
  if (idx === -1) return { success: false };
  Object.assign(store.clips[idx], data);
  await setStore(store);
  notifyUpdate();
  return { success: true };
}

async function deleteClip(id) {
  const store = await getStore();
  store.clips = store.clips.filter((c) => c.id !== id);
  await setStore(store);
  notifyUpdate();
  return { success: true };
}

async function getNotebooks() {
  const store = await getStore();
  return { notebooks: store.notebooks };
}

async function addNotebook(name) {
  const store = await getStore();
  if (!store.notebooks.includes(name)) {
    store.notebooks.push(name);
    await setStore(store);
  }
  return { success: true, notebooks: store.notebooks };
}

async function deleteNotebook(name) {
  if (name === 'General') return { success: false, error: 'Cannot delete General' };
  const store = await getStore();
  store.notebooks = store.notebooks.filter((n) => n !== name);
  store.clips.forEach((c) => {
    if (c.notebook === name) c.notebook = 'General';
  });
  await setStore(store);
  notifyUpdate();
  return { success: true };
}

async function importClips(data) {
  const store = await getStore();
  let imported = 0;
  for (const c of data.clips || []) {
    store.clips.unshift({
      id: store.nextId++,
      content: c.content || '',
      title: c.title || c.content.slice(0, 80),
      notebook: c.notebook || 'General',
      tags: c.tags || [],
      source: c.source || '',
      sourceTitle: c.sourceTitle || '',
      format: c.format || 'text',
      clippedAt: c.clippedAt || Date.now(),
      favorite: c.favorite || false
    });
    imported++;
  }
  for (const n of data.notebooks || []) {
    if (!store.notebooks.includes(n)) store.notebooks.push(n);
  }
  await setStore(store);
  notifyUpdate();
  return { success: true, imported };
}

async function exportClips() {
  const store = await getStore();
  return {
    clips: store.clips,
    notebooks: store.notebooks,
    exportedAt: new Date().toISOString()
  };
}

async function exportMarkdown(filter) {
  const res = await getClips(filter);
  let md = '# AIClip Export\n\n';
  for (const c of res.clips) {
    md += `## ${c.title}\n`;
    md += `**Notebook:** ${c.notebook}`;
    if (c.tags.length) md += ` | **Tags:** ${c.tags.join(', ')}`;
    md += `\n\n`;
    md += `${c.content}\n\n`;
    if (c.source) md += `*Source: ${c.source}*\n\n`;
    md += `---\n\n`;
  }
  return { markdown: md };
}

async function clearAll() {
  await setStore({ clips: [], notebooks: DEFAULT_NOTEBOOKS, nextId: 1 });
  notifyUpdate();
  return { success: true };
}

function notifyUpdate() {
  chrome.runtime.sendMessage({ type: 'CLIPS_UPDATED' }).catch(() => {});
}

function getByteSizeEstimate(obj) {
  return new Blob([JSON.stringify(obj)]).size;
}
