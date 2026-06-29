const $ = (s) => document.querySelector(s);
let allNotebooks = [];
let favoritesOnly = false;

document.addEventListener('DOMContentLoaded', () => {
  loadNotebooks();
  loadClips();
  bindEvents();
});

function bindEvents() {
  $('#search-input').addEventListener('input', debounce(loadClips, 200));
  $('#filter-notebook').addEventListener('change', loadClips);

  $('#filter-all').addEventListener('click', () => {
    favoritesOnly = false;
    $('#filter-all').classList.add('active');
    $('#filter-favs').classList.remove('active');
    loadClips();
  });
  $('#filter-favs').addEventListener('click', () => {
    favoritesOnly = true;
    $('#filter-favs').classList.add('active');
    $('#filter-all').classList.remove('active');
    loadClips();
  });

  $('#btn-export-json').addEventListener('click', exportJSON);
  $('#btn-export-md').addEventListener('click', exportMarkdown);
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', importClips);
  $('#btn-options').addEventListener('click', () => chrome.runtime.openOptionsPage());

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'CLIPS_UPDATED') {
      loadClips();
      loadNotebooks();
    }
  });
}

async function loadNotebooks() {
  const res = await send({ type: 'GET_NOTEBOOKS' });
  allNotebooks = res.notebooks || [];
  const select = $('#filter-notebook');
  select.innerHTML = '<option value="All">All</option>' +
    allNotebooks.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
}

async function loadClips() {
  const filter = {
    search: $('#search-input').value.trim(),
    notebook: $('#filter-notebook').value,
    favoritesOnly
  };

  const res = await send({ type: 'GET_CLIPS', filter });
  const clips = res.clips || [];
  const list = $('#clip-list');

  if (!clips.length) {
    list.innerHTML = '<div class="empty-state">No clips yet.<br>Visit any AI chatbot and click the Clip button on a response.</div>';
  } else {
    list.innerHTML = clips.map((c) => renderCard(c)).join('');
    bindCardEvents(clips);
  }

  const allRes = await send({ type: 'GET_CLIPS', filter: {} });
  const all = allRes.clips || [];
  $('#stat-total').textContent = all.length;
  $('#stat-notebooks').textContent = allNotebooks.length;
  $('#stat-favs').textContent = all.filter((c) => c.favorite).length;
}

function renderCard(c) {
  const tags = (c.tags || []).map((t) => `<span class="clip-tag">${esc(t)}</span>`).join('');
  return `
    <div class="clip-card" data-id="${c.id}">
      <div class="clip-card-header">
        <span class="clip-card-title">${esc(c.title)}</span>
        <span class="clip-card-fav ${c.favorite ? 'active' : ''}" data-fav="${c.id}">${c.favorite ? '★' : '☆'}</span>
      </div>
      <div class="clip-card-text">${esc(c.content)}</div>
      <div class="clip-card-meta">
        <span class="clip-notebook-badge">${esc(c.notebook)}</span>
        ${tags}
        <span class="clip-date">${timeAgo(c.clippedAt)}</span>
      </div>
      <div class="clip-card-actions">
        <button class="card-action-btn copy-btn">Copy</button>
        <button class="card-action-btn insert-btn">Insert</button>
        <button class="card-action-btn delete">Delete</button>
      </div>
    </div>`;
}

function bindCardEvents(clips) {
  document.querySelectorAll('.clip-card').forEach((card) => {
    const id = parseInt(card.dataset.id);
    const clip = clips.find((c) => c.id === id);
    if (!clip) return;

    card.querySelector('.copy-btn').addEventListener('click', async () => {
      await navigator.clipboard.writeText(clip.content);
      showToast('Copied to clipboard');
    });

    card.querySelector('.insert-btn').addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'INSERT_INTO_INPUT', text: clip.content });
        showToast('Inserted');
        window.close();
      } catch {
        await navigator.clipboard.writeText(clip.content);
        showToast('Copied (not on AI site)');
      }
    });

    card.querySelector('.delete').addEventListener('click', async () => {
      await send({ type: 'DELETE_CLIP', id });
      loadClips();
      showToast('Clip deleted');
    });

    card.querySelector('.clip-card-fav').addEventListener('click', async () => {
      await send({ type: 'UPDATE_CLIP', id, data: { favorite: !clip.favorite } });
      loadClips();
    });
  });
}

async function exportJSON() {
  const data = await send({ type: 'EXPORT_CLIPS' });
  download(JSON.stringify(data, null, 2), `aiclip_export_${dateStr()}.json`, 'application/json');
  showToast('Exported as JSON');
}

async function exportMarkdown() {
  const filter = {
    search: $('#search-input').value.trim(),
    notebook: $('#filter-notebook').value,
    favoritesOnly
  };
  const res = await send({ type: 'EXPORT_MARKDOWN', filter });
  download(res.markdown, `aiclip_export_${dateStr()}.md`, 'text/markdown');
  showToast('Exported as Markdown');
}

function importClips(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      const res = await send({ type: 'IMPORT_CLIPS', data });
      showToast(`Imported ${res.imported} clips`);
      loadClips();
      loadNotebooks();
    } catch {
      showToast('Invalid JSON file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function download(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function showToast(text) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + 'd ago';
  return new Date(ts).toLocaleDateString();
}

function dateStr() { return new Date().toISOString().slice(0, 10); }

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
