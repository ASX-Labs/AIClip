const $ = (s) => document.querySelector(s);

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadNotebooks();
  loadLibrary();
  bindEvents();
});

function initTabs() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      item.classList.add('active');
      $(`#tab-${item.dataset.tab}`).classList.add('active');
    });
  });
}

function bindEvents() {
  $('#add-notebook-btn').addEventListener('click', addNotebook);
  $('#new-notebook').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addNotebook();
  });
  $('#export-json-btn').addEventListener('click', exportJSON);
  $('#export-md-btn').addEventListener('click', exportMarkdown);
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', importData);
  $('#clear-btn').addEventListener('click', clearAll);
  $('#lib-search').addEventListener('input', debounce(loadLibrary, 200));
  $('#lib-filter').addEventListener('change', loadLibrary);
}

function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

async function loadNotebooks() {
  const res = await send({ type: 'GET_CLIPS', filter: {} });
  const notebooks = res.notebooks || [];
  const clips = res.clips || [];

  const list = $('#notebooks-list');
  list.innerHTML = notebooks.map((n) => {
    const count = clips.filter((c) => c.notebook === n).length;
    const isDefault = n === 'General';
    return `
      <div class="notebook-row">
        <span>
          <span class="notebook-name">${esc(n)}</span>
          <span class="notebook-count">${count} clip${count !== 1 ? 's' : ''}</span>
        </span>
        ${isDefault ? '' : `<button class="notebook-delete" data-name="${esc(n)}">x</button>`}
      </div>`;
  }).join('');

  list.querySelectorAll('.notebook-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await send({ type: 'DELETE_NOTEBOOK', name: btn.dataset.name });
      loadNotebooks();
      loadLibrary();
      showToast('Notebook deleted');
    });
  });

  const filterSelect = $('#lib-filter');
  const current = filterSelect.value;
  filterSelect.innerHTML = '<option value="All">All</option>' +
    notebooks.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  filterSelect.value = current || 'All';
}

async function addNotebook() {
  const input = $('#new-notebook');
  const name = input.value.trim();
  if (!name) return;
  await send({ type: 'ADD_NOTEBOOK', name });
  input.value = '';
  loadNotebooks();
  showToast('Notebook added');
}

async function loadLibrary() {
  const filter = {
    search: $('#lib-search').value.trim(),
    notebook: $('#lib-filter').value
  };
  const res = await send({ type: 'GET_CLIPS', filter });
  const clips = res.clips || [];
  const list = $('#library-list');

  $('#lib-count').textContent = `${clips.length} clip${clips.length !== 1 ? 's' : ''}`;

  if (!clips.length) {
    list.innerHTML = '<div class="lib-empty">No clips found.</div>';
    return;
  }

  list.innerHTML = clips.map((c) => {
    const date = new Date(c.clippedAt).toLocaleDateString();
    const tags = (c.tags || []).map((t) => `<span class="lib-badge lib-badge-tag">${esc(t)}</span>`).join('');
    const sourceHost = c.source ? new URL(c.source).hostname : '';
    return `
      <div class="lib-card" data-id="${c.id}">
        <div class="lib-card-header">
          <span class="lib-card-title">${c.favorite ? '★ ' : ''}${esc(c.title)}</span>
          <div class="lib-card-actions">
            <button class="lib-action-btn copy-btn">Copy</button>
            <button class="lib-action-btn fav-btn">${c.favorite ? 'Unfav' : 'Fav'}</button>
            <button class="lib-action-btn delete">Delete</button>
          </div>
        </div>
        <div class="lib-card-text">${esc(c.content)}</div>
        <div class="lib-card-meta">
          <span class="lib-badge lib-badge-notebook">${esc(c.notebook)}</span>
          ${tags}
          ${sourceHost ? `<span class="lib-badge lib-badge-source">${esc(sourceHost)}</span>` : ''}
          <span class="lib-badge lib-badge-date">${date}</span>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.lib-card').forEach((card) => {
    const id = parseInt(card.dataset.id);
    const clip = clips.find((c) => c.id === id);

    card.querySelector('.copy-btn').addEventListener('click', async () => {
      await navigator.clipboard.writeText(clip.content);
      showToast('Copied to clipboard');
    });

    card.querySelector('.fav-btn').addEventListener('click', async () => {
      await send({ type: 'UPDATE_CLIP', id, data: { favorite: !clip.favorite } });
      loadLibrary();
    });

    card.querySelector('.delete').addEventListener('click', async () => {
      await send({ type: 'DELETE_CLIP', id });
      loadLibrary();
      loadNotebooks();
      showToast('Clip deleted');
    });
  });
}

async function exportJSON() {
  const data = await send({ type: 'EXPORT_CLIPS' });
  download(JSON.stringify(data, null, 2), `aiclip_export_${dateStr()}.json`, 'application/json');
  showToast('Exported as JSON');
}

async function exportMarkdown() {
  const res = await send({ type: 'EXPORT_MARKDOWN', filter: {} });
  download(res.markdown, `aiclip_export_${dateStr()}.md`, 'text/markdown');
  showToast('Exported as Markdown');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      const res = await send({ type: 'IMPORT_CLIPS', data });
      showToast(`Imported ${res.imported} clips`);
      loadLibrary();
      loadNotebooks();
    } catch {
      showToast('Invalid JSON file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

async function clearAll() {
  if (!confirm('Delete all clips and notebooks? This cannot be undone.')) return;
  await send({ type: 'CLEAR_ALL' });
  loadLibrary();
  loadNotebooks();
  showToast('All data cleared');
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

function dateStr() { return new Date().toISOString().slice(0, 10); }

function showToast(text) {
  document.querySelector('.options-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'options-toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
