const SETTINGS_KEY = 'doomai_settings';
const CONVERSATIONS_KEY = 'doomai_conversations';
const ACTIVE_CONVERSATION_KEY = 'doomai_active_conversation';
const SHORTCUTS_KEY = 'doomai_shortcuts';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  systemPrompt: '',
};

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadConversations() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversations(conversations) {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

let settings = loadSettings();
let conversations = loadConversations();
let activeId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);

if (conversations.length === 0 || !conversations.find((c) => c.id === activeId)) {
  activeId = createConversation();
}

function createConversation() {
  const id = `c_${Date.now()}`;
  conversations.unshift({ id, title: 'New chat', messages: [] });
  saveConversations(conversations);
  localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
  return id;
}

function getActiveConversation() {
  return conversations.find((c) => c.id === activeId);
}

function applyTheme() {
  document.body.classList.toggle('theme-light', settings.theme === 'light');
}

function switchView(view) {
  document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.querySelectorAll('.dock-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  if (view === 'connections') loadConnections();
  if (view === 'history') renderSavedChatsList();
  if (view === 'models') renderModelsView();
  if (view === 'files') renderFilesView();
  if (view === 'admin') loadAdminView();
  location.hash = view;
}

function renderConversationList() {
  // Kept so other code (e.g. after sending a message) can refresh titles;
  // it just re-renders the Saved Chats list if that view happens to be open.
  const list = document.getElementById('savedChatsList');
  if (list) renderSavedChatsList();
}

function renderSavedChatsList() {
  const list = document.getElementById('savedChatsList');
  if (!list) return;
  list.innerHTML = '';

  if (conversations.length === 0) {
    list.innerHTML = '<p class="saved-chats-empty">No saved chats yet — start one from "+ New chat".</p>';
    return;
  }

  conversations.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'saved-chat-row' + (c.id === activeId ? ' active' : '');

    const title = document.createElement('span');
    title.className = 'saved-chat-title';
    title.textContent = c.title || 'New chat';
    title.addEventListener('click', () => {
      activeId = c.id;
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeId);
      renderMessages();
      switchView('chat');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-chat-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete chat';
    deleteBtn.addEventListener('click', () => showInlineDeleteConfirm(row, title, deleteBtn, c.id));

    row.appendChild(title);
    row.appendChild(deleteBtn);
    list.appendChild(row);
  });
}

// Replaces a row's title + delete icon with an inline "Delete this chat? Yes / Cancel"
// control — no native browser confirm() popup.
function showInlineDeleteConfirm(row, title, deleteBtn, conversationId) {
  title.classList.add('hidden');
  deleteBtn.classList.add('hidden');

  const confirmBox = document.createElement('div');
  confirmBox.className = 'delete-confirm-inline';

  const label = document.createElement('span');
  label.textContent = 'Delete this chat?';

  const yesBtn = document.createElement('button');
  yesBtn.type = 'button';
  yesBtn.className = 'confirm-yes';
  yesBtn.textContent = 'Delete';
  yesBtn.addEventListener('click', () => deleteConversation(conversationId));

  const noBtn = document.createElement('button');
  noBtn.type = 'button';
  noBtn.className = 'confirm-no';
  noBtn.textContent = 'Cancel';
  noBtn.addEventListener('click', () => renderSavedChatsList());

  confirmBox.appendChild(label);
  confirmBox.appendChild(yesBtn);
  confirmBox.appendChild(noBtn);
  row.appendChild(confirmBox);
}

function deleteConversation(id) {
  conversations = conversations.filter((c) => c.id !== id);
  saveConversations(conversations);

  if (activeId === id) {
    activeId = conversations.length > 0 ? conversations[0].id : createConversation();
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeId);
    renderMessages();
  }

  renderSavedChatsList();
}

function renderMessages() {
  const container = document.getElementById('messages');
  container.innerHTML = '';
  const conversation = getActiveConversation();
  if (!conversation || conversation.messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <img src="/logo.svg" class="empty-state-logo" alt="" />
        <h1>Antikythera GPT Chat</h1>
        <p>Ask me anything, or connect an app from the sidebar.</p>
      </div>`;
    return;
  }
  conversation.messages.forEach((m) => {
    const bubble = document.createElement('div');
    bubble.className = `message ${m.role}`;
    bubble.textContent = m.content;
    container.appendChild(bubble);
    if (m.flightResults) {
      renderFlightResultsCard(container, m.flightResults);
    }
    if (m.hotelResults) {
      renderHotelResultsCard(container, m.hotelResults);
    }
  });
  container.scrollTop = container.scrollHeight;
}

const THINKING_PHRASES = [
  'Thinking hard...',
  'Grab a coffee, this might take a moment...',
  'Solving a complex problem...',
  'Crunching the details...',
  'Finding the best solution...',
  'Finalizing the answer...',
  'Almost there...',
];

function showThinkingIndicator(container, phrases = THINKING_PHRASES) {
  const bubble = document.createElement('div');
  bubble.className = 'message assistant thinking';

  const loader = document.createElement('div');
  loader.className = 'gear-loader';
  loader.innerHTML = `
    <svg viewBox="0 0 24 24" class="gear-spin" aria-hidden="true" fill="currentColor">
      <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87c-0.12,0.21-0.08,0.47,0.12,0.61l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
    </svg>
    <span class="gear-orbit-dot dot-1"></span>
    <span class="gear-orbit-dot dot-2"></span>
    <span class="gear-orbit-dot dot-3"></span>
    <span class="gear-orbit-dot dot-4"></span>
  `;

  const text = document.createElement('span');
  text.textContent = phrases[0];

  bubble.appendChild(loader);
  bubble.appendChild(text);
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  let i = 0;
  const intervalId = setInterval(() => {
    i = (i + 1) % phrases.length;
    text.textContent = phrases[i];
  }, 1800);

  return () => {
    clearInterval(intervalId);
    bubble.remove();
  };
}

let attachedFile = null; // { name, content }
let deepSearchActive = false;

function renderAttachmentChip() {
  const chip = document.getElementById('attachedFileChip');
  chip.innerHTML = '';
  if (!attachedFile) {
    chip.classList.add('hidden');
    return;
  }
  chip.classList.remove('hidden');
  const label = document.createElement('span');
  label.textContent = `📎 ${attachedFile.name}`;
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    attachedFile = null;
    renderAttachmentChip();
  });
  chip.appendChild(label);
  chip.appendChild(removeBtn);
}

// Lightweight parser: looks for "XXX to YYY ... YYYY-MM-DD" using 3-letter IATA-style
// codes. Deliberately simple (same philosophy as the sports "today"/"live" keyword check)
// rather than full NLP — if it can't confidently find all three pieces, it returns null and
// the caller falls back to asking the user to rephrase.
function parseFlightQuery(text) {
  const match = text.match(/\b([A-Za-z]{3})\s*(?:to|-|→|>)\s*([A-Za-z]{3})\b[\s\S]{0,20}?(\d{4}-\d{2}-\d{2})/i);
  if (!match) return null;
  return {
    from: match[1].toUpperCase(),
    to: match[2].toUpperCase(),
    date: match[3],
  };
}

// Renders real flight results as their own card in the message stream immediately —
// independent of whatever the model says afterward, similar to how a travel-search tool
// result "pops up" rather than only being described in prose.
function renderFlightResultsCard(container, data) {
  const card = document.createElement('div');
  card.className = 'flight-results-card';

  const header = document.createElement('div');
  header.className = 'flight-results-header';
  header.textContent = `✈️ Flights: ${data.from} → ${data.to} on ${data.date}`;
  card.appendChild(header);

  data.flights.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'flight-row';

    let depTime = '';
    if (f.departure) {
      try {
        depTime = new Date(f.departure).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        depTime = f.departure;
      }
    }

    const info = document.createElement('div');
    info.className = 'flight-row-info';
    info.innerHTML = `
      <div class="flight-airline">${escapeHtml(f.airline || 'Unknown airline')}</div>
      <div class="flight-route">${escapeHtml(f.from)} (${escapeHtml(f.fromCode)}) → ${escapeHtml(f.to)} (${escapeHtml(f.toCode)})</div>
      <div class="flight-meta">${depTime ? escapeHtml(depTime) + ' · ' : ''}${f.stops === 0 ? 'Direct' : `${f.stops} stop(s)`}${f.durationText ? ` · ${escapeHtml(f.durationText)}` : ''}</div>
    `;

    const priceBook = document.createElement('div');
    priceBook.className = 'flight-row-price';
    const priceEl = document.createElement('div');
    priceEl.className = 'flight-price';
    priceEl.textContent = `${f.price} ${f.currency}`;
    priceBook.appendChild(priceEl);
    if (f.bookingUrl) {
      const link = document.createElement('a');
      link.href = f.bookingUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'flight-book-link';
      link.textContent = 'Book ↗';
      priceBook.appendChild(link);
    }

    row.appendChild(info);
    row.appendChild(priceBook);
    card.appendChild(row);
  });

  container.appendChild(card);
  container.scrollTop = container.scrollHeight;
}

// Looks for a 3-letter city code plus two YYYY-MM-DD dates (check-in, check-out) in either
// order within a short span of text. Same deliberately-simple philosophy as the flight
// parser — if it can't confidently find all three pieces, returns null.
function parseHotelQuery(text) {
  const match = text.match(
    /\b([A-Za-z]{3})\b[\s\S]{0,20}?(\d{4}-\d{2}-\d{2})[\s\S]{0,20}?(\d{4}-\d{2}-\d{2})/i
  );
  if (!match) return null;
  const [d1, d2] = [match[2], match[3]].sort();
  return {
    city: match[1].toUpperCase(),
    checkin: d1,
    checkout: d2,
  };
}

function renderHotelResultsCard(container, data) {
  const card = document.createElement('div');
  card.className = 'flight-results-card';

  const header = document.createElement('div');
  header.className = 'flight-results-header';
  header.textContent = `🏨 Hotels in ${data.city}: ${data.checkin} → ${data.checkout}`;
  card.appendChild(header);

  if (data.hotels.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'flight-row';
    empty.textContent = 'No live offers found for this city/date range in the sample dataset.';
    card.appendChild(empty);
  }

  data.hotels.forEach((h) => {
    const row = document.createElement('div');
    row.className = 'flight-row';

    const info = document.createElement('div');
    info.className = 'flight-row-info';
    info.innerHTML = `
      <div class="flight-airline">${escapeHtml(h.name || 'Unnamed hotel')}</div>
      <div class="flight-route">${h.rating ? '★'.repeat(Math.round(h.rating)) : ''}</div>
      <div class="flight-meta">${escapeHtml(h.roomType || 'Room details unavailable')}</div>
    `;

    const priceBook = document.createElement('div');
    priceBook.className = 'flight-row-price';
    const priceEl = document.createElement('div');
    priceEl.className = 'flight-price';
    priceEl.textContent = h.price ? `${h.price} ${h.currency}` : 'Price unavailable';
    priceBook.appendChild(priceEl);

    row.appendChild(info);
    row.appendChild(priceBook);
    card.appendChild(row);
  });

  if (data.bookingUrl) {
    const footer = document.createElement('div');
    footer.className = 'flight-row';
    const link = document.createElement('a');
    link.href = data.bookingUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'flight-book-link';
    link.textContent = 'Compare & book on Booking.com ↗';
    footer.appendChild(link);
    card.appendChild(footer);
  }

  container.appendChild(card);
  container.scrollTop = container.scrollHeight;
}

async function sendMessage(rawText) {
  const conversation = getActiveConversation();
  const currentAttachment = attachedFile;
  const useDeepSearch = deepSearchActive;
  attachedFile = null;
  renderAttachmentChip();

  const displayText = currentAttachment ? `${rawText}\n\n📎 Attached: ${currentAttachment.name}` : rawText;
  conversation.messages.push({ role: 'user', content: displayText });
  if (conversation.title === 'New chat') {
    conversation.title = rawText.slice(0, 40) || 'New chat';
  }
  saveConversations(conversations);
  renderConversationList();
  renderMessages();

  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  const initialPhrases = useDeepSearch ? ['Searching the web...', ...THINKING_PHRASES] : THINKING_PHRASES;
  let stopThinking = showThinkingIndicator(document.getElementById('messages'), initialPhrases);

  let augmentedContent = rawText;
  let searchFailureNote = null;

  try {
    if (useDeepSearch) {
      try {
        const searchRes = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: rawText }),
        });
        const searchData = await searchRes.json();
        if (searchRes.ok && searchData.results?.length) {
          const resultsText = searchData.results
            .map((r, i) => `${i + 1}. ${r.title} (${r.url})\n${r.description}`)
            .join('\n\n');
          const today = new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          augmentedContent = `${augmentedContent}\n\n--- Live web search results (retrieved just now, today is ${today}) ---\n${resultsText}\n\nThese results are more current than your training data — treat them as the source of truth for anything date-sensitive or recent, rather than falling back on what you already "know". Use them where relevant and cite sources by URL.`;
        } else if (searchRes.ok) {
          augmentedContent = `${augmentedContent}\n\n(Web search ran but returned no results for this query — answer from your own knowledge and say so if it's likely outdated.)`;
        } else {
          searchFailureNote = searchData.error || `Web search request failed (HTTP ${searchRes.status}).`;
          augmentedContent = `${augmentedContent}\n\n(Web search was requested but failed: ${searchFailureNote} — tell the user web search didn't run this time, then answer from your own knowledge and say so if it's likely outdated.)`;
        }
      } catch (err) {
        searchFailureNote = `Web search request failed: ${err.message}`;
        augmentedContent = `${augmentedContent}\n\n(Web search was requested but failed: ${searchFailureNote} — tell the user web search didn't run this time, then answer from your own knowledge and say so if it's likely outdated.)`;
      }
    }

    {
      const parsed = parseFlightQuery(rawText);
      if (parsed) {
        try {
          const flightsRes = await fetch(
            `/api/flights/search?from=${encodeURIComponent(parsed.from)}&to=${encodeURIComponent(parsed.to)}&date=${parsed.date}`
          );
          const flightsData = await flightsRes.json();
          if (flightsRes.ok && flightsData.flights?.length) {
            conversation.messages[conversation.messages.length - 1].flightResults = flightsData;
            saveConversations(conversations);
            stopThinking();
            renderMessages();
            stopThinking = showThinkingIndicator(document.getElementById('messages'), THINKING_PHRASES);
            const flightsText = flightsData.flights
              .map(
                (f, i) =>
                  `${i + 1}. ${f.airline || 'Unknown airline'}: ${f.from} (${f.fromCode}) → ${f.to} (${f.toCode}), ` +
                  `departs ${f.departure}, ${f.stops === 0 ? 'direct' : f.stops + ' stop(s)'}, ` +
                  `${f.durationText || ''}, ${f.price} ${f.currency}`
              )
              .join('\n');
            augmentedContent = `${augmentedContent}\n\n--- Live flight search results for ${parsed.from} → ${parsed.to} on ${parsed.date} ---\n${flightsText}\n\nThese are real current fares, already shown to the user as a card above your reply — summarize/compare them briefly rather than re-listing every detail.`;
          } else if (flightsRes.ok) {
            augmentedContent = `${augmentedContent}\n\n(Flight search ran for ${parsed.from} → ${parsed.to} on ${parsed.date} but found no results — say so and suggest trying different dates/airports.)`;
          }
        } catch {
          // flight search failed — proceed without it
        }
      }
    }

    {
      const parsed = parseHotelQuery(rawText);
      if (parsed) {
        try {
          const hotelsRes = await fetch(
            `/api/hotels/search?city=${encodeURIComponent(parsed.city)}&checkin=${parsed.checkin}&checkout=${parsed.checkout}`
          );
          const hotelsData = await hotelsRes.json();
          if (hotelsRes.ok) {
            conversation.messages[conversation.messages.length - 1].hotelResults = hotelsData;
            saveConversations(conversations);
            stopThinking();
            renderMessages();
            stopThinking = showThinkingIndicator(document.getElementById('messages'), THINKING_PHRASES);

            if (hotelsData.hotels?.length) {
              const hotelsText = hotelsData.hotels
                .map((h, i) => `${i + 1}. ${h.name || 'Unnamed hotel'}: ${h.price ?? '?'} ${h.currency ?? ''} (${h.roomType || 'room type n/a'})`)
                .join('\n');
              augmentedContent = `${augmentedContent}\n\n--- Live hotel search results for ${parsed.city}, ${parsed.checkin} → ${parsed.checkout} ---\n${hotelsText}\n\nThese are real current rates from a sample/test dataset (not full production inventory), already shown to the user as a card above your reply — summarize/compare them briefly rather than re-listing every detail, and mention they're worth double-checking on the linked booking site since this is a sample dataset.`;
            } else {
              augmentedContent = `${augmentedContent}\n\n(Hotel search ran for ${parsed.city}, ${parsed.checkin} → ${parsed.checkout} but found no offers in the sample dataset — say so, and point to the "Compare & book" link already shown to the user for a full real search.)`;
            }
          }
        } catch {
          // hotel search failed — proceed without it
        }
      }
    }

    if (currentAttachment) {
      augmentedContent = `${augmentedContent}\n\n--- Content of attached file "${currentAttachment.name}" ---\n${currentAttachment.content}`;
    }

    const payloadMessages = conversation.messages.map((m) => ({ role: m.role, content: m.content }));
    payloadMessages[payloadMessages.length - 1] = { role: 'user', content: augmentedContent };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: payloadMessages,
        systemPrompt: settings.systemPrompt || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      conversation.messages.push({ role: 'error', content: data.error || 'Request failed.' });
    } else {
      if (searchFailureNote) {
        conversation.messages.push({ role: 'error', content: `⚠️ Web search didn't run: ${searchFailureNote}` });
      }
      conversation.messages.push({ role: 'assistant', content: data.reply });
    }
  } catch (err) {
    conversation.messages.push({ role: 'error', content: err.message });
  } finally {
    stopThinking();
  }

  saveConversations(conversations);
  renderMessages();
  sendBtn.disabled = false;
}

const PROVIDER_ICONS = {
  google: `<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.66Z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.92l-3.88-3a7.4 7.4 0 0 1-4.06 1.15c-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1Z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z"/></svg>`,
  microsoft: `<svg viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/></svg>`,
  github: `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
      0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
      -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
      .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
      -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
      1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
      1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
      1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`,
  slack: `<svg viewBox="0 0 24 24"><path fill="#36C5F0" d="M9.5 15a2.5 2.5 0 0 1-2.5 2.5 2.5 2.5 0 0 1-2.5-2.5A2.5 2.5 0 0 1 7 12.5h2.5V15Z"/><path fill="#2EB67D" d="M10.75 15a2.5 2.5 0 0 1 2.5-2.5 2.5 2.5 0 0 1 2.5 2.5v6.25a2.5 2.5 0 0 1-2.5 2.5 2.5 2.5 0 0 1-2.5-2.5V15Z"/><path fill="#ECB22E" d="M13.25 9a2.5 2.5 0 0 1-2.5-2.5A2.5 2.5 0 0 1 13.25 4a2.5 2.5 0 0 1 2.5 2.5v2.5h-2.5Z"/><path fill="#E01E5A" d="M13.25 10.25a2.5 2.5 0 0 1 2.5 2.5 2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5 2.5 2.5 0 0 1 2.5-2.5h6.25Z"/></svg>`,
  zoom: `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#2D8CFF"/><path fill="#fff" d="M6 9.5A1.5 1.5 0 0 1 7.5 8h6A1.5 1.5 0 0 1 15 9.5v5A1.5 1.5 0 0 1 13.5 16h-6A1.5 1.5 0 0 1 6 14.5v-5Z"/><path fill="#fff" d="m16 10.8 2.7-1.9c.4-.28.9.02.9.5v5.2c0 .48-.5.78-.9.5L16 13.2v-2.4Z"/></svg>`,
  dropbox: `<svg viewBox="0 0 24 24"><path fill="#0061FF" d="M6 3 0 6.75 6 10.5 12 6.75 6 3ZM18 3l-6 3.75 6 3.75 6-3.75L18 3ZM0 14.25 6 18l6-3.75L6 10.5l-6 3.75ZM12 14.25 18 18l6-3.75-6-3.75-6 3.75ZM6 19.5l6 3.75 6-3.75-6-3.75-6 3.75Z"/></svg>`,
  canvas: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#E2492D"/><path fill="#fff" d="M12 5a7 7 0 1 0 7 7c0-.55-.06-1.08-.16-1.6a3.5 3.5 0 0 1-4.24-4.24A6.96 6.96 0 0 0 12 5Z"/></svg>`,
};

async function loadConnections() {
  const list = document.getElementById('connectionsList');
  list.innerHTML = '<p class="hint">Loading...</p>';
  const response = await fetch('/api/connections');
  const providers = await response.json();

  list.innerHTML = '';
  providers.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'connection-row';

    const icon = document.createElement('span');
    icon.className = 'connection-icon';
    icon.innerHTML = PROVIDER_ICONS[p.key] || '';
    row.appendChild(icon);

    const info = document.createElement('div');
    info.className = 'connection-info';
    const label = document.createElement('span');
    label.className = 'connection-label';
    label.textContent = p.label;
    const status = document.createElement('span');
    if (p.connected) {
      status.className = 'connection-status connected';
      status.textContent = `Connected${p.connectedAt ? ' · ' + new Date(p.connectedAt).toLocaleString() : ''}`;
    } else if (!p.configured) {
      status.className = 'connection-status not-configured';
      status.textContent = 'Not configured on server (missing client ID/secret)';
    } else {
      status.className = 'connection-status';
      status.textContent = 'Not connected';
    }
    info.appendChild(label);
    info.appendChild(status);
    row.appendChild(info);

    if (p.connected) {
      const btn = document.createElement('button');
      btn.className = 'disconnect-btn';
      btn.textContent = 'Disconnect';
      btn.addEventListener('click', async () => {
        await fetch(`/api/connections/${p.key}/disconnect`, { method: 'POST' });
        loadConnections();
      });
      row.appendChild(btn);
    } else {
      const link = document.createElement('a');
      link.className = 'connect-btn' + (p.configured ? '' : ' disabled');
      link.textContent = 'Connect';
      link.href = `/auth/${p.key}/start`;
      row.appendChild(link);
    }

    list.appendChild(row);
  });
}

function initSettingsForm() {
  document.getElementById('themeSelect').value = settings.theme;
  document.getElementById('systemPromptInput').value = settings.systemPrompt;

  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    settings = {
      theme: document.getElementById('themeSelect').value,
      systemPrompt: document.getElementById('systemPromptInput').value.trim(),
    };
    saveSettings(settings);
    applyTheme();
    const confirm = document.getElementById('saveConfirm');
    confirm.classList.remove('hidden');
    setTimeout(() => confirm.classList.add('hidden'), 1500);
  });
}

async function initNotificationPreference() {
  const checkbox = document.getElementById('emailNotificationsCheckbox');
  try {
    const response = await fetch('/api/preferences');
    const data = await response.json();
    checkbox.checked = Boolean(data.emailNotifications);
  } catch {
    // non-critical — checkbox just stays unchecked
  }

  checkbox.addEventListener('change', async () => {
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailNotifications: checkbox.checked }),
      });
    } catch {
      // non-critical — preference just won't persist across sessions
    }
  });
}

let ACTIVE_MODEL = 'llama3.2';
let isAdmin = false;

async function loadUserInfo() {
  try {
    const response = await fetch('/api/session');
    const data = await response.json();
    if (data.user) {
      document.getElementById('userEmail').textContent = data.user.email;
      document.getElementById('userAvatar').textContent = (data.user.email || '?').charAt(0).toUpperCase();
      document.getElementById('userMenuWrapper').classList.remove('hidden');
    }
    if (data.defaultModel) {
      ACTIVE_MODEL = data.defaultModel;
      document.getElementById('modelPickerCurrent').textContent = `Ollama · ${ACTIVE_MODEL}`;
    }
    isAdmin = Boolean(data.isAdmin);
    document.getElementById('userAdminBadge').classList.toggle('hidden', !isAdmin);
    document.getElementById('adminNavBtn').classList.toggle('hidden', !isAdmin);
  } catch {
    // non-critical — sidebar just won't show the signed-in email
  }
}

function renderModelsView() {
  const display = document.getElementById('currentModelDisplayDock');
  if (display) display.textContent = `Ollama · ${ACTIVE_MODEL}`;
}

async function loadAdminView() {
  try {
    const [statsRes, settingsRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/settings'),
    ]);
    const stats = await statsRes.json();
    const adminSettings = await settingsRes.json();

    document.getElementById('adminStatUsers').textContent = stats.userCount ?? '—';
    document.getElementById('adminStatConnections').textContent = stats.connectionsCount ?? '—';
    document.getElementById('adminModelInput').value = adminSettings.defaultModel || '';
    document.getElementById('adminAnnouncementInput').value = adminSettings.announcement || '';
  } catch {
    // non-critical — panel just shows whatever was already there
  }
}

function initAdminPanel() {
  const saveBtn = document.getElementById('adminSaveBtn');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', async () => {
    const defaultModel = document.getElementById('adminModelInput').value.trim();
    const announcement = document.getElementById('adminAnnouncementInput').value.trim();
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultModel, announcement }),
    });
    ACTIVE_MODEL = defaultModel || ACTIVE_MODEL;
    loadAnnouncementBanner();
    const confirm = document.getElementById('adminSaveConfirm');
    confirm.classList.remove('hidden');
    setTimeout(() => confirm.classList.add('hidden'), 1500);
  });
}

async function loadAnnouncementBanner() {
  const banner = document.getElementById('announcementBanner');
  if (!banner) return;
  try {
    const response = await fetch('/api/announcement');
    const data = await response.json();
    if (data.announcement) {
      banner.textContent = data.announcement;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch {
    banner.classList.add('hidden');
  }
}

let sessionAttachedFiles = [];

function renderFilesView() {
  const list = document.getElementById('attachedFilesList');
  if (!list) return;
  list.innerHTML = '';

  if (sessionAttachedFiles.length === 0) {
    list.innerHTML = '<p class="hint">No files attached yet this session.</p>';
    return;
  }

  sessionAttachedFiles.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'attached-file-row';

    const name = document.createElement('span');
    name.textContent = `📎 ${f.name}`;

    const time = document.createElement('span');
    time.className = 'file-time';
    time.textContent = f.attachedAt.toLocaleTimeString();

    row.appendChild(name);
    row.appendChild(time);
    list.appendChild(row);
  });
}

function initUserMenu() {
  const btn = document.getElementById('userMenuBtn');
  const popover = document.getElementById('userMenuPopover');
  const search = document.getElementById('userMenuSearch');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.classList.toggle('hidden');
    if (!popover.classList.contains('hidden')) {
      search.value = '';
      filterUserMenuItems('');
      search.focus();
    }
  });

  search.addEventListener('input', () => filterUserMenuItems(search.value));
  search.addEventListener('click', (e) => e.stopPropagation());

  document.querySelectorAll('.user-menu-item[data-action]').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (item.dataset.action === 'personalization') {
        e.preventDefault();
        switchView('settings');
        popover.classList.add('hidden');
      }
      // 'download' is disabled (placeholder, no-op); 'logout' is a real link, no JS needed
    });
  });

  document.addEventListener('click', () => popover.classList.add('hidden'));
  popover.addEventListener('click', (e) => e.stopPropagation());
}

function filterUserMenuItems(query) {
  const q = query.trim().toLowerCase();
  document.querySelectorAll('.user-menu-item').forEach((item) => {
    const matches = !q || item.textContent.toLowerCase().includes(q);
    item.classList.toggle('filtered-out', !matches);
  });
}

function initModelPicker() {
  document.getElementById('modelPickerCurrent').textContent = `Ollama · ${ACTIVE_MODEL}`;
}

const CUSTOM_SECTIONS_KEY = 'doomai_custom_sections';
const SECTION_TYPE_ICONS = { calendar: '📅', notes: '📝', generic: '📁' };

function loadCustomSections() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_SECTIONS_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomSections(sections) {
  localStorage.setItem(CUSTOM_SECTIONS_KEY, JSON.stringify(sections));
}

let customSections = loadCustomSections();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function buildCalendarHtml() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const monthName = now.toLocaleString('default', { month: 'long' });

  let cells = '';
  for (let i = 0; i < startWeekday; i++) {
    cells += '<div class="calendar-cell empty"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells += `<div class="calendar-cell${d === now.getDate() ? ' today' : ''}">${d}</div>`;
  }

  return `
    <div class="calendar-widget">
      <div class="calendar-header">${monthName} ${year}</div>
      <div class="calendar-grid">
        <div class="calendar-cell weekday">Su</div>
        <div class="calendar-cell weekday">Mo</div>
        <div class="calendar-cell weekday">Tu</div>
        <div class="calendar-cell weekday">We</div>
        <div class="calendar-cell weekday">Th</div>
        <div class="calendar-cell weekday">Fr</div>
        <div class="calendar-cell weekday">Sa</div>
        ${cells}
      </div>
      <p class="hint">Display-only for now — no events or sync yet.</p>
    </div>`;
}

function ensureCustomSectionView(section) {
  const viewId = `view-custom-${section.id}`;
  if (document.getElementById(viewId)) return;

  const view = document.createElement('section');
  view.id = viewId;
  view.className = 'view hidden';

  if (section.type === 'calendar') {
    view.innerHTML = `<h2>${SECTION_TYPE_ICONS.calendar} ${escapeHtml(section.name)}</h2>${buildCalendarHtml()}`;
  } else {
    const storageKey = `doomai_section_text_${section.id}`;
    view.innerHTML = `
      <h2>${SECTION_TYPE_ICONS[section.type] || '📁'} ${escapeHtml(section.name)}</h2>
      <textarea class="section-textarea" placeholder="Write here — saved automatically in your browser, not synced anywhere."></textarea>`;
    const textarea = view.querySelector('.section-textarea');
    textarea.value = localStorage.getItem(storageKey) || '';
    textarea.addEventListener('input', () => {
      localStorage.setItem(storageKey, textarea.value);
    });
  }

  document.querySelector('.main').appendChild(view);
}

function renderCustomSectionsList() {
  const list = document.getElementById('customSectionsList');
  list.innerHTML = '';
  customSections.forEach((section) => {
    ensureCustomSectionView(section);

    const row = document.createElement('div');
    row.className = 'custom-section-row';

    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.view = `custom-${section.id}`;
    btn.textContent = `${SECTION_TYPE_ICONS[section.type] || '📁'} ${section.name}`;
    btn.addEventListener('click', () => switchView(`custom-${section.id}`));
    row.appendChild(btn);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-section-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove section';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCustomSection(section.id);
    });
    row.appendChild(removeBtn);

    list.appendChild(row);
  });
}

function addCustomSection(type) {
  const defaultNames = { calendar: 'Calendar', notes: 'Notes', generic: 'Section' };
  const name = prompt('Name this section:', defaultNames[type] || 'Section');
  if (!name) return;
  customSections.push({ id: `s_${Date.now()}`, type, name: name.trim() });
  saveCustomSections(customSections);
  renderCustomSectionsList();
}

function removeCustomSection(id) {
  customSections = customSections.filter((s) => s.id !== id);
  saveCustomSections(customSections);
  const view = document.getElementById(`view-custom-${id}`);
  if (view) view.remove();
  renderCustomSectionsList();
  switchView('chat');
}

// --- Text expander shortcuts ("az" -> full saved paragraph, like TextExpander) ---

function loadShortcuts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHORTCUTS_KEY));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveShortcuts(map) {
  localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(map));
}

let shortcuts = loadShortcuts();

function renderShortcutsList() {
  const list = document.getElementById('shortcutsList');
  if (!list) return;
  list.innerHTML = '';

  const triggers = Object.keys(shortcuts);
  if (triggers.length === 0) {
    list.innerHTML = '<p class="hint">No shortcuts yet — add one below.</p>';
    return;
  }

  triggers.forEach((trigger) => {
    const row = document.createElement('div');
    row.className = 'shortcut-row';

    const triggerEl = document.createElement('span');
    triggerEl.className = 'shortcut-trigger';
    triggerEl.textContent = trigger;

    const preview = document.createElement('span');
    preview.className = 'shortcut-preview';
    preview.textContent = shortcuts[trigger];

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'delete-chat-btn';
    removeBtn.textContent = '🗑️';
    removeBtn.title = 'Remove shortcut';
    removeBtn.addEventListener('click', () => {
      delete shortcuts[trigger];
      saveShortcuts(shortcuts);
      renderShortcutsList();
    });

    row.appendChild(triggerEl);
    row.appendChild(preview);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

function initShortcutsForm() {
  renderShortcutsList();

  const addBtn = document.getElementById('addShortcutBtn');
  const triggerInput = document.getElementById('shortcutTriggerInput');
  const expansionInput = document.getElementById('shortcutExpansionInput');

  addBtn.addEventListener('click', () => {
    const trigger = triggerInput.value.trim().toLowerCase();
    const expansion = expansionInput.value.trim();
    if (!trigger || !expansion || /\s/.test(trigger)) return;

    shortcuts[trigger] = expansion;
    saveShortcuts(shortcuts);
    triggerInput.value = '';
    expansionInput.value = '';
    renderShortcutsList();
  });
}

// Expands the word immediately before `cursor` in `el.value` if it matches a shortcut
// trigger exactly. Returns true if an expansion happened.
function tryExpandShortcut(el, cursor) {
  const value = el.value;
  const before = value.slice(0, cursor);
  const match = before.match(/(\S+)$/);
  if (!match) return false;

  const word = match[1];
  const expansion = shortcuts[word.toLowerCase()];
  if (!expansion) return false;

  const wordStart = cursor - word.length;
  const after = value.slice(cursor);
  const needsSpace = after.length === 0 || !/^\s/.test(after);
  const insertion = expansion + (needsSpace ? ' ' : '');

  el.value = value.slice(0, wordStart) + insertion + after;
  const newCursor = wordStart + insertion.length;
  el.setSelectionRange(newCursor, newCursor);
  return true;
}

function initComposerShortcuts() {
  const composerInput = document.getElementById('composerInput');
  composerInput.addEventListener('input', (e) => {
    if (e.data === ' ') {
      tryExpandShortcut(composerInput, composerInput.selectionStart - 1);
    }
  });
}

function init() {
  applyTheme();
  renderConversationList();
  renderMessages();
  initSettingsForm();
  loadUserInfo();
  initUserMenu();
  initModelPicker();
  initAdminPanel();
  loadAnnouncementBanner();
  initNotificationPreference();
  renderCustomSectionsList();
  initShortcutsForm();
  initComposerShortcuts();

  const addSectionBtn = document.getElementById('addSectionBtn');
  const addSectionMenu = document.getElementById('addSectionMenu');
  addSectionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    addSectionMenu.classList.toggle('hidden');
  });
  addSectionMenu.querySelectorAll('.add-section-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      addCustomSection(opt.dataset.type);
      addSectionMenu.classList.add('hidden');
    });
  });
  document.addEventListener('click', () => addSectionMenu.classList.add('hidden'));

  document.getElementById('newChatBtn').addEventListener('click', () => {
    activeId = createConversation();
    renderConversationList();
    renderMessages();
    switchView('chat');
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  const composerForm = document.getElementById('composerForm');
  const composerInput = document.getElementById('composerInput');
  composerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = composerInput.value.trim();
    if (!text) return;
    composerInput.value = '';
    sendMessage(text);
  });
  composerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      tryExpandShortcut(composerInput, composerInput.selectionStart);
      composerForm.requestSubmit();
    }
  });

  document.getElementById('connectBtn').addEventListener('click', () => switchView('connections'));

  const attachBtn = document.getElementById('attachBtn');
  const fileInput = document.getElementById('fileInput');
  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      attachedFile = { name: file.name, content: reader.result };
      sessionAttachedFiles.unshift({ name: file.name, attachedAt: new Date() });
      renderAttachmentChip();
      renderFilesView();
    };
    reader.readAsText(file);
  });

  const deepSearchBtn = document.getElementById('deepSearchBtn');
  deepSearchBtn.addEventListener('click', () => {
    deepSearchActive = !deepSearchActive;
    deepSearchBtn.classList.toggle('active', deepSearchActive);
  });

  initVoiceButton();
  initBottomDock();

  const initialView = location.hash.replace('#', '') || 'chat';
  const validViews = [
    'chat',
    'settings',
    'connections',
    'history',
    'models',
    'files',
    ...customSections.map((s) => `custom-${s.id}`),
  ];
  if (validViews.includes(initialView)) {
    switchView(initialView);
  }
}

function initBottomDock() {
  document.querySelectorAll('.dock-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function initVoiceButton() {
  const voiceBtn = document.getElementById('voiceBtn');
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) {
    voiceBtn.title = 'Voice input not supported in this browser (try Chrome or Edge)';
    voiceBtn.disabled = true;
    return;
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.continuous = false;

  let listening = false;

  recognition.addEventListener('result', (event) => {
    const transcript = Array.from(event.results)
      .map((r) => r[0].transcript)
      .join(' ');
    const input = document.getElementById('composerInput');
    input.value = input.value ? `${input.value} ${transcript}` : transcript;
  });

  recognition.addEventListener('end', () => {
    listening = false;
    voiceBtn.classList.remove('active');
  });

  recognition.addEventListener('error', () => {
    listening = false;
    voiceBtn.classList.remove('active');
  });

  voiceBtn.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
    } else {
      recognition.start();
      listening = true;
      voiceBtn.classList.add('active');
    }
  });
}

init();
