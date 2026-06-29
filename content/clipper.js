const SITE_CONFIG = {
  'chat.openai.com':   { responses: '[data-message-author-role="assistant"]', input: '#prompt-textarea, div[contenteditable="true"][id="prompt-textarea"]' },
  'chatgpt.com':       { responses: '[data-message-author-role="assistant"]', input: '#prompt-textarea, div[contenteditable="true"][id="prompt-textarea"]' },
  'claude.ai':         { responses: '[data-is-streaming] .font-claude-message, .font-claude-message', input: 'div.ProseMirror[contenteditable="true"]' },
  'gemini.google.com': { responses: '.response-content, .model-response-text, message-content', input: 'div.ql-editor[contenteditable="true"], rich-textarea .ql-editor' },
  'perplexity.ai':     { responses: '.prose, [class*="answer"]', input: 'textarea[placeholder], div[contenteditable="true"]' },
  'www.perplexity.ai': { responses: '.prose, [class*="answer"]', input: 'textarea[placeholder], div[contenteditable="true"]' },
  'grok.x.com':        { responses: '[class*="message"][class*="bot"], [class*="response"]', input: 'textarea' },
  'chat.deepseek.com': { responses: '.ds-markdown, [class*="assistant"]', input: 'textarea, div[contenteditable="true"]' }
};

const config = SITE_CONFIG[location.hostname];
let overlayOpen = false;
let overlayEl = null;
let clipButtonsInjected = false;

if (config) {
  injectClipButtons();
  observeNewResponses();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TOGGLE_CLIPS_OVERLAY') {
    toggleOverlay();
    sendResponse({ success: true });
  }
});

function injectClipButtons() {
  if (!config) return;
  const responses = document.querySelectorAll(config.responses);
  responses.forEach((el) => addClipButton(el));
  clipButtonsInjected = true;
}

function addClipButton(responseEl) {
  if (responseEl.querySelector('.aiclip-btn')) return;
  if (!responseEl.textContent.trim()) return;

  const btn = document.createElement('button');
  btn.className = 'aiclip-btn';
  btn.textContent = 'Clip';
  btn.title = 'Save to AIClip';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();

    const content = responseEl.innerText.trim();
    if (!content) return;

    chrome.runtime.sendMessage({
      type: 'SAVE_CLIP',
      data: {
        content,
        source: location.href,
        sourceTitle: document.title,
        notebook: 'General',
        tags: [],
        format: 'text'
      }
    }, (res) => {
      if (res && res.success) {
        btn.textContent = 'Clipped!';
        btn.classList.add('aiclip-btn-done');
        setTimeout(() => {
          btn.textContent = 'Clip';
          btn.classList.remove('aiclip-btn-done');
        }, 2000);
      }
    });
  });

  responseEl.style.position = responseEl.style.position || 'relative';
  responseEl.appendChild(btn);
}

function observeNewResponses() {
  if (!config) return;
  const observer = new MutationObserver(() => {
    const responses = document.querySelectorAll(config.responses);
    responses.forEach((el) => addClipButton(el));
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Context menu clip from selection
document.addEventListener('mouseup', () => {
  const sel = window.getSelection();
  if (sel && sel.toString().trim().length > 0) {
    window.__aiclip_selection = sel.toString().trim();
  }
});

// Overlay
function toggleOverlay() {
  if (overlayOpen) {
    closeOverlay();
  } else {
    openOverlay();
  }
}

function openOverlay() {
  if (overlayEl) overlayEl.remove();

  overlayEl = document.createElement('div');
  overlayEl.id = 'aiclip-overlay';
  overlayEl.innerHTML = `
    <div class="ac-backdrop"></div>
    <div class="ac-panel">
      <div class="ac-header">
        <span class="ac-logo">AIClip</span>
        <button class="ac-close" id="ac-close">x</button>
      </div>
      <div class="ac-search-row">
        <input type="text" id="ac-search" placeholder="Search clips..." class="ac-input">
        <select id="ac-filter" class="ac-select">
          <option value="All">All</option>
        </select>
      </div>
      <div class="ac-list" id="ac-list"></div>
    </div>
  `;

  document.body.appendChild(overlayEl);
  overlayOpen = true;

  overlayEl.querySelector('.ac-backdrop').addEventListener('click', closeOverlay);
  overlayEl.querySelector('#ac-close').addEventListener('click', closeOverlay);
  overlayEl.querySelector('#ac-search').addEventListener('input', debounce(loadOverlayClips, 200));
  overlayEl.querySelector('#ac-filter').addEventListener('change', loadOverlayClips);

  loadOverlayNotebooks();
  loadOverlayClips();
  overlayEl.querySelector('#ac-search').focus();
}

function closeOverlay() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  overlayOpen = false;
}

function loadOverlayNotebooks() {
  chrome.runtime.sendMessage({ type: 'GET_NOTEBOOKS' }, (res) => {
    if (!res) return;
    const select = overlayEl?.querySelector('#ac-filter');
    if (!select) return;
    select.innerHTML = '<option value="All">All</option>' +
      (res.notebooks || []).map((n) => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('');
  });
}

function loadOverlayClips() {
  const search = overlayEl?.querySelector('#ac-search')?.value.trim() || '';
  const notebook = overlayEl?.querySelector('#ac-filter')?.value || 'All';

  chrome.runtime.sendMessage({ type: 'GET_CLIPS', filter: { search, notebook } }, (res) => {
    if (!res) return;
    const list = overlayEl?.querySelector('#ac-list');
    if (!list) return;

    const clips = res.clips || [];
    if (!clips.length) {
      list.innerHTML = '<div class="ac-empty">No clips saved yet</div>';
      return;
    }

    list.innerHTML = clips.map((c) => `
      <div class="ac-item" data-id="${c.id}">
        <div class="ac-item-header">
          <span class="ac-item-title">${escHtml(c.title)}</span>
          <span class="ac-item-fav ${c.favorite ? 'active' : ''}" data-fav="${c.id}">${c.favorite ? '★' : '☆'}</span>
        </div>
        <div class="ac-item-text">${escHtml(c.content)}</div>
        <div class="ac-item-meta">
          <span class="ac-item-notebook">${escHtml(c.notebook)}</span>
          ${(c.tags || []).map((t) => `<span class="ac-item-tag">${escHtml(t)}</span>`).join('')}
          <span class="ac-item-date">${timeAgo(c.clippedAt)}</span>
        </div>
        <div class="ac-item-actions">
          <button class="ac-action copy-btn">Copy</button>
          <button class="ac-action insert-btn">Insert</button>
          <button class="ac-action delete-btn">Delete</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.ac-item').forEach((item) => {
      const id = parseInt(item.dataset.id);
      const clip = clips.find((c) => c.id === id);

      item.querySelector('.copy-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(clip.content);
        showOverlayToast('Copied');
      });

      item.querySelector('.insert-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        insertIntoInput(clip.content);
        closeOverlay();
      });

      item.querySelector('.delete-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: 'DELETE_CLIP', id }, () => loadOverlayClips());
      });

      item.querySelector('.ac-item-fav')?.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({
          type: 'UPDATE_CLIP', id, data: { favorite: !clip.favorite }
        }, () => loadOverlayClips());
      });
    });
  });
}

function insertIntoInput(text) {
  if (!config) return;
  const el = document.querySelector(config.input);
  if (!el) return;

  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const setter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    ).set;
    setter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    el.focus();
    el.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = text;
    el.appendChild(p);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.focus();
}

function showOverlayToast(text) {
  const toast = document.createElement('div');
  toast.className = 'ac-toast';
  toast.textContent = text;
  overlayEl?.querySelector('.ac-panel')?.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
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

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
