const PATH_PREFIX = window.location.pathname.replace(/\/$/, '');
const API_BASE = (PATH_PREFIX === '' ? '' : PATH_PREFIX) + '/api/attendance';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

let isLocked = false;
let noDinnerActive = false;
let noDinnerMessage = '';
let adminMode = false;

function formatDateDisplay(dateStr) {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  const date = new Date(year, month, day);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[date.getDay()];
  return dayName + ', ' + MONTHS[month] + ' ' + day + ', ' + year;
}

function formatLastModifiedTime(isoStr) {
  if (!isoStr) return '';
  const parts = isoStr.split('T');
  const dateParts = parts[0].split('-');
  const timeParts = parts[1].split(':');
  const month = parseInt(dateParts[1]);
  const day = parseInt(dateParts[2]);
  let hour = parseInt(timeParts[0]);
  const minute = timeParts[1];
  const ampm = hour >= 12 ? 'p' : 'a';
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return month + '/' + day + ' ' + hour + ':' + minute + ampm + ' ET';
}

function getResetFriday() {
  const now = new Date();
  const day = now.getDay();
  let daysUntilFriday;
  if (day === 5) {
    daysUntilFriday = 0;
  } else if (day === 6) {
    daysUntilFriday = 6;
  } else if (day === 0) {
    daysUntilFriday = 5;
  } else {
    daysUntilFriday = (5 - day + 7) % 7;
  }
  const friday = new Date(now);
  friday.setDate(now.getDate() + daysUntilFriday);
  friday.setHours(0, 0, 0, 0);
  const month = friday.getMonth() + 1;
  const dayNum = friday.getDate();
  const year = friday.getFullYear();
  const m = month.toString().padStart(2, '0');
  const d = dayNum.toString().padStart(2, '0');
  return m + '/' + d + '/' + year;
}

async function fetchAttendance() {
  const response = await fetch(API_BASE);
  return await response.json();
}

async function updateAttendance(family, data) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ family: family }, data))
  });
  return await response.json();
}

async function updateLockState(locked) {
  const response = await fetch(API_BASE + '/lock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locked: locked })
  });
  return await response.json();
}

async function updateNoDinnerState(noDinner, message) {
  const response = await fetch(API_BASE + '/no-dinner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ noDinner: noDinner, message: message })
  });
  return await response.json();
}

async function adminAddFamily(name, count) {
  const response = await fetch(API_BASE + '/admin/add-family', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, count: count })
  });
  return await response.json();
}

async function adminToggleActive(name) {
  const response = await fetch(API_BASE + '/admin/toggle-active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name })
  });
  return await response.json();
}
/** Admin API: delete a family card */
async function adminDeleteFamily(name) {
  const response = await fetch(API_BASE + '/admin/delete-family', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name })
  });
  return await response.json();
}

function showCardSaved(savedEl) {
  if (!savedEl) return;
  if (savedEl._savedTimeout) clearTimeout(savedEl._savedTimeout);
  if (savedEl._fadeTimeout) clearTimeout(savedEl._fadeTimeout);
  savedEl.classList.remove('fading');
  savedEl.textContent = 'Saved \u2713';
  void savedEl.offsetWidth;
  savedEl.classList.add('visible');
  savedEl._fadeTimeout = setTimeout(() => {
    savedEl.classList.add('fading');
    savedEl._hideTimeout = setTimeout(() => {
      savedEl.classList.remove('visible', 'fading');
    }, 300);
  }, 5000);
}

function pulseHighlight(card, area) {
  if (area === 'attending') {
    const select = card.querySelector('.number-select');
    if (select) {
      select.classList.remove('highlight-pulse-select');
      void select.offsetWidth;
      select.classList.add('highlight-pulse-select');
    }
  } else {
    const row = card.querySelector('.card-comment-row');
    if (row) {
      row.classList.remove('highlight-pulse');
      void row.offsetWidth;
      row.classList.add('highlight-pulse');
    }
  }
}

function celebrateGoing(card) {
  const container = document.createElement('div');
  container.className = 'celebration-container';
  card.style.position = 'relative';
  card.appendChild(container);
  const icons = ['\ud83c\udf88', '\ud83c\udf89', '\ud83c\udf8a', '\ud83c\udf88', '\ud83c\udf89', '\ud83c\udf8a', '\u2728', '\ud83c\udf1f', '\ud83d\udcab', '\ud83c\udf8a', '\ud83c\udf89', '\ud83c\udf88'];
  icons.forEach((emoji, i) => {
    const el = document.createElement('span');
    el.className = i < 6 ? 'balloon' : 'confetti';
    el.textContent = emoji;
    el.style.left = (5 + Math.random() * 85) + '%';
    el.style.animationDelay = (Math.random() * 0.5) + 's';
    container.appendChild(el);
  });
  setTimeout(() => { if (container.parentNode) container.remove(); }, 3200);
}

function celebrateNotGoing(card) {
  card.style.position = 'relative';
  const sad = document.createElement('span');
  sad.className = 'sad-emoji';
  sad.textContent = '\ud83d\ude22';
  sad.style.left = (35 + Math.random() * 20) + '%';
  sad.style.top = (20 + Math.random() * 30) + '%';
  card.appendChild(sad);
  setTimeout(() => { if (sad.parentNode) sad.remove(); }, 2200);
}

function confirmPam(actionLabel) {
  return confirm('You are asking to enter admin mode.\n\nAre you Pam?\n\n(You are about to: ' + actionLabel + ')');
}

function applyAdminMode() {
  const adminBtn = document.getElementById('adminBtn');
  const adminToolbar = document.getElementById('adminToolbar');
  if (adminMode) {
    document.body.classList.add('admin-mode');
    if (adminBtn) adminBtn.classList.add('active');
    if (adminToolbar) adminToolbar.style.display = 'flex';
  } else {
    document.body.classList.remove('admin-mode');
    if (adminBtn) adminBtn.classList.remove('active');
    if (adminToolbar) adminToolbar.style.display = 'none';
  }
  document.querySelectorAll('.card-admin-row').forEach(row => {
    row.style.display = adminMode ? 'flex' : 'none';
  });
}

function applyLockState() {
  const cards = document.querySelectorAll('.family-card:not(.inactive-card)');
  cards.forEach(card => {
    const notGoingBtn = card.querySelector('.toggle-btn[data-value="not-going"]');
    const goingBtn = card.querySelector('.toggle-btn[data-value="going"]');
    const select = card.querySelector('.number-select');
    const commentInput = card.querySelector('.card-comment-input');
    const lastMod = card.querySelector('.last-modified');
    const lockBadge = card.querySelector('.lock-badge');

    if (isLocked) {
      card.classList.add('locked');
      if (notGoingBtn) { notGoingBtn.disabled = true; notGoingBtn.classList.add('locked-disabled'); }
      if (goingBtn) { goingBtn.disabled = true; goingBtn.classList.add('locked-disabled'); }
      if (select) select.disabled = true;
      if (commentInput) commentInput.disabled = true;
      if (!lockBadge) {
        const badge = document.createElement('span');
        badge.className = 'lock-badge';
        badge.textContent = '\ud83d\udd12';
        if (card.firstChild) card.insertBefore(badge, card.firstChild);
        else card.appendChild(badge);
      }
      if (lastMod && !lastMod.classList.contains('locked')) {
        lastMod.dataset.originalText = lastMod.textContent || '';
        lastMod.textContent = '\ud83d\udd12 Locked \u2014 Call Pam to change';
        lastMod.classList.add('locked');
      }
      if (!card.dataset.lockClickHandler) {
        card.dataset.lockClickHandler = 'true';
        card.addEventListener('click', (e) => {
          if (isLocked) {
            const lm = card.querySelector('.last-modified.locked');
            if (lm) flashLockedMessage(lm);
          }
        });
      }
    } else {
      card.classList.remove('locked');
      if (notGoingBtn) { notGoingBtn.disabled = false; notGoingBtn.classList.remove('locked-disabled'); }
      if (goingBtn) { goingBtn.disabled = false; goingBtn.classList.remove('locked-disabled'); }
      if (commentInput) commentInput.disabled = false;
      if (select) {
        const going = goingBtn && goingBtn.classList.contains('active-going');
        select.disabled = !going;
      }
      if (lockBadge) lockBadge.remove();
      if (lastMod && lastMod.classList.contains('locked')) {
        lastMod.textContent = lastMod.dataset.originalText || '';
        lastMod.classList.remove('locked');
        lastMod.style.backgroundColor = 'transparent';
        lastMod.style.padding = '';
        lastMod.style.borderRadius = '';
      }
    }
  });

  const lockBtn = document.getElementById('lockBtn');
  if (lockBtn) {
    lockBtn.classList.toggle('locked', isLocked);
    lockBtn.title = isLocked ? 'Unlock Reservations' : 'Lock Reservations';
    const label = lockBtn.querySelector('.admin-tool-label');
    if (label) label.textContent = isLocked ? 'Unlock Reservations' : 'Lock Reservations';
    const svg = lockBtn.querySelector('svg');
    if (svg) {
      if (isLocked) {
        svg.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path><path d="M12 15v3"></path>';
      } else {
        svg.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>';
      }
    }
  }
}

function flashLockedMessage(lastMod) {
  lastMod.style.transition = 'background-color 0.05s';
  lastMod.style.backgroundColor = 'rgba(240, 192, 64, 0.3)';
  lastMod.style.borderRadius = '4px';
  lastMod.style.padding = '2px 6px';
  setTimeout(() => { lastMod.style.backgroundColor = 'transparent'; }, 300);
}

function applyNoDinnerState() {
  const overlayCard = document.getElementById('overlayCard');
  const overlayTitle = document.getElementById('overlayCardTitle');
  const messageInput = document.getElementById('overlayMessageInput');
  const noDinnerBtn = document.getElementById('noDinnerBtn');
  const totalSection = document.getElementById('totalSection');
  const cardsContainer = document.getElementById('cardsContainer');
  const inactiveSection = document.getElementById('inactiveSection');

  if (noDinnerActive) {
    const titleDateEl = document.getElementById('titleDate');
    const dateText = titleDateEl.textContent.replace('For: ', '');
    overlayTitle.textContent = 'No Dinner for ' + dateText;
    messageInput.value = noDinnerMessage || '';
    overlayCard.classList.add('active');
    cardsContainer.style.display = 'none';
    totalSection.style.display = 'none';
    if (inactiveSection) inactiveSection.style.display = 'none';
    if (noDinnerBtn) {
      noDinnerBtn.classList.add('active');
      noDinnerBtn.title = 'Cancel Dinner (active)';
      const label = noDinnerBtn.querySelector('.admin-tool-label');
      if (label) label.textContent = 'Uncancel Dinner';
    }
  } else {
    overlayCard.classList.remove('active');
    cardsContainer.style.display = '';
    totalSection.style.display = '';
    if (noDinnerBtn) {
      noDinnerBtn.classList.remove('active');
      noDinnerBtn.title = 'Cancel Dinner';
      const label = noDinnerBtn.querySelector('.admin-tool-label');
      if (label) label.textContent = 'Cancel Dinner';
    }
    updateInactiveSection();
  }
}

function updateCardInPlace(card, data) {
  const going = data.going;
  const notGoingBtn = card.querySelector('.toggle-btn[data-value="not-going"]');
  const goingBtn = card.querySelector('.toggle-btn[data-value="going"]');
  const select = card.querySelector('.number-select');
  const commentInput = card.querySelector('.card-comment-input');
  const lastMod = card.querySelector('.last-modified');

  card.classList.toggle('going', going);
  if (notGoingBtn) {
    notGoingBtn.classList.toggle('active-not-going', !going);
    notGoingBtn.textContent = going ? 'Not Going' : '\u2715 Not Going';
  }
  if (goingBtn) {
    goingBtn.classList.toggle('active-going', going);
    goingBtn.textContent = going ? '\u2705 Going' : 'Going';
  }
  if (select) {
    select.value = data.count;
    select.disabled = !going || isLocked;
  }
  if (commentInput) {
    commentInput.value = data.comments || '';
    const clearBtn = card.querySelector('.comment-clear-btn');
    if (clearBtn) clearBtn.classList.toggle('visible', (data.comments || '').length > 0);
  }
  if (lastMod && !lastMod.classList.contains('locked')) {
    if (data.lastModified) {
      const ipParts = data.lastModified.ip.split('.');
      const shortIp = ipParts.slice(0, 2).join('.') + '.x.x';
      lastMod.textContent = '(' + shortIp + ' ' + formatLastModifiedTime(data.lastModified.time) + ')';
    } else {
      lastMod.textContent = '';
    }
    lastMod.dataset.originalText = lastMod.textContent || '';
  }
}

function createFamilyCard(name, data) {
  const isInactive = data.active === false;
  const card = document.createElement('div');
  card.className = 'family-card' + (data.going && !isInactive ? ' going' : '') + (isInactive ? ' inactive-card' : '');
  card.dataset.family = name;
  card.style.transition = 'order 0.5s ease, border-color 0.3s';

  const row1 = document.createElement('div');
  row1.className = 'card-row-1';
  const nameEl = document.createElement('div');
  nameEl.className = 'family-name';
  nameEl.textContent = name;

  const toggleContainer = document.createElement('div');
  toggleContainer.className = 'toggle-container';
  const notGoingBtn = document.createElement('button');
  notGoingBtn.className = 'toggle-btn' + (data.going || isInactive ? '' : ' active-not-going');
  notGoingBtn.textContent = data.going || isInactive ? 'Not Going' : '\u2715 Not Going';
  notGoingBtn.dataset.value = 'not-going';
  notGoingBtn.type = 'button';
  const goingBtn = document.createElement('button');
  goingBtn.className = 'toggle-btn' + (data.going && !isInactive ? ' active-going' : '');
  goingBtn.textContent = data.going && !isInactive ? '\u2705 Going' : 'Going';
  goingBtn.dataset.value = 'going';
  goingBtn.type = 'button';

  if (isInactive) {
    notGoingBtn.disabled = true; notGoingBtn.classList.add('locked-disabled');
    goingBtn.disabled = true; goingBtn.classList.add('locked-disabled');
  }

  toggleContainer.appendChild(notGoingBtn);
  toggleContainer.appendChild(goingBtn);
  row1.appendChild(nameEl);
  row1.appendChild(toggleContainer);

  const commentRow = document.createElement('div');
  commentRow.className = 'card-comment-row';
  const commentInput = document.createElement('input');
  commentInput.type = 'text';
  commentInput.className = 'card-comment-input';
  commentInput.placeholder = 'Add Comments';
  commentInput.value = data.comments || '';

  const clearBtn = document.createElement('button');
  clearBtn.className = 'comment-clear-btn' + (data.comments ? ' visible' : '');
  clearBtn.textContent = 'Clear';
  clearBtn.type = 'button';
  clearBtn.tabIndex = -1;
  commentRow.appendChild(commentInput);
  commentRow.appendChild(clearBtn);

  const bottomSection = document.createElement('div');
  bottomSection.className = 'card-bottom';
  const row2 = document.createElement('div');
  row2.className = 'card-row-2';
  const selectLabel = document.createElement('span');
  selectLabel.className = 'number-label';
  selectLabel.textContent = 'Attending:';
  const select = document.createElement('select');
  select.className = 'number-select';
  for (let i = 1; i <= 6; i++) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = i;
    if (i === data.count) opt.selected = true;
    select.appendChild(opt);
  }
  select.disabled = !data.going || isInactive;
  row2.appendChild(selectLabel);
  row2.appendChild(select);
  bottomSection.appendChild(row2);

  const row3 = document.createElement('div');
  row3.className = 'card-row-3';
  const savedEl = document.createElement('span');
  savedEl.className = 'saved-indicator';
  row3.appendChild(savedEl);
  const lastMod = document.createElement('span');
  lastMod.className = 'last-modified';
  if (data.lastModified) {
    const ipParts = data.lastModified.ip.split('.');
    const shortIp = ipParts.slice(0, 2).join('.') + '.x.x';
    lastMod.textContent = '(' + shortIp + ' ' + formatLastModifiedTime(data.lastModified.time) + ')';
  }
  lastMod.dataset.originalText = lastMod.textContent || '';
  row3.appendChild(lastMod);

  card.appendChild(row1);
  card.appendChild(bottomSection);
  card.appendChild(commentRow);
  card.appendChild(row3);

  // Admin row
  const adminRow = document.createElement('div');
  adminRow.className = 'card-admin-row';
  const moveBtn = document.createElement('button');
  if (isInactive) {
    moveBtn.className = 'move-active-btn';
    moveBtn.textContent = '\u25b6 Move to Active';
    moveBtn.title = 'Move this attendee back to active';
    moveBtn.addEventListener('click', async () => {
      try { await adminToggleActive(name); } catch (err) { console.error(err); }
    });
  } else {
    moveBtn.className = 'move-inactive-btn';
    moveBtn.textContent = '\u25a0 Move to Inactive';
    moveBtn.title = 'Move this attendee to inactive';
    moveBtn.addEventListener('click', async () => {
      try { await adminToggleActive(name); } catch (err) { console.error(err); }
    });
  }
  adminRow.appendChild(moveBtn);

  // Delete button (visible in admin mode)
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-card-btn';
  deleteBtn.textContent = 'Delete';
  deleteBtn.title = 'Delete this card permanently';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete the card for "' + name + '"?\n\nThis cannot be undone.')) return;
    try {
      const result = await adminDeleteFamily(name);
      if (!result.success) {
        alert(result.error || 'Failed to delete card');
      }
      // SSE will re-render on success
    } catch (err) {
      console.error('Failed to delete card:', err);
      alert('Error deleting card.');
    }
  });
  adminRow.appendChild(deleteBtn);

  card.appendChild(adminRow);
  if (adminMode) adminRow.style.display = 'flex';

  // Event handlers
  // Toggle/select handlers only for active cards
  if (!isInactive) {
    function setGoing(going) {
      card.classList.toggle('going', going);
      notGoingBtn.classList.toggle('active-not-going', !going);
      goingBtn.classList.toggle('active-going', going);
      notGoingBtn.textContent = going ? 'Not Going' : '\u2715 Not Going';
      goingBtn.textContent = going ? '\u2705 Going' : 'Going';
      select.disabled = !going;
    }

    notGoingBtn.addEventListener('click', async () => {
      if (isLocked || notGoingBtn.disabled) return;
      const wasGoing = goingBtn.classList.contains('active-going');
      if (!wasGoing) return;
      setGoing(false);
      await updateAttendance(name, { going: false });
      updateTotal();
      showCardSaved(savedEl);
      pulseHighlight(card, 'comments');
      celebrateNotGoing(card);
    });

    goingBtn.addEventListener('click', async () => {
      if (isLocked || goingBtn.disabled) return;
      const wasGoing = goingBtn.classList.contains('active-going');
      if (wasGoing) return;
      setGoing(true);
      await updateAttendance(name, { going: true, count: parseInt(select.value, 10) });
      updateTotal();
      showCardSaved(savedEl);
      pulseHighlight(card, 'attending');
      celebrateGoing(card);
    });

    select.addEventListener('change', async () => {
      if (isLocked) return;
      await updateAttendance(name, { count: parseInt(select.value, 10) });
      updateTotal();
      showCardSaved(savedEl);
    });
  }

  // Comment handlers work for all cards (active and inactive)
  function updateClearBtn() { clearBtn.classList.toggle('visible', commentInput.value.length > 0); }
  commentInput.addEventListener('input', updateClearBtn);
  commentInput.addEventListener('blur', async () => {
    if (isLocked) return;
    await updateAttendance(name, { comments: commentInput.value });
    showCardSaved(savedEl);
  });
  clearBtn.addEventListener('click', async () => {
    if (isLocked) return;
    commentInput.value = '';
    updateClearBtn();
    await updateAttendance(name, { comments: '' });
    showCardSaved(savedEl);
  });

  return card;
}

function updateTotal() {
  const cards = document.querySelectorAll('.family-card:not(.inactive-card)');
  let total = 0;
  cards.forEach(card => {
    const goingBtn = card.querySelector('.toggle-btn[data-value="going"]');
    const select = card.querySelector('.number-select');
    if (goingBtn && goingBtn.classList.contains('active-going') && select) {
      total += parseInt(select.value, 10);
    }
  });
  document.getElementById('totalCount').textContent = total;
  document.getElementById('badgeCount').textContent = total;
}

function updateInactiveSection() {
  const inactiveSection = document.getElementById('inactiveSection');
  const inactiveCards = document.querySelectorAll('.family-card.inactive-card');
  if (inactiveCards.length > 0 && !noDinnerActive) {
    inactiveSection.style.display = 'block';
  } else {
    inactiveSection.style.display = 'none';
  }
}

function renderAllCards(familiesData) {
  const container = document.getElementById('cardsContainer');
  const inactiveContainer = document.getElementById('inactiveCardsContainer');
  container.innerHTML = '';
  if (inactiveContainer) inactiveContainer.innerHTML = '';

  const activeFamilies = {};
  const inactiveFamilies = {};
  for (const [name, info] of Object.entries(familiesData)) {
    if (info.active === false) inactiveFamilies[name] = info;
    else activeFamilies[name] = info;
  }

  for (const name in activeFamilies) container.appendChild(createFamilyCard(name, activeFamilies[name]));

  if (inactiveContainer) {
    for (const name in inactiveFamilies) inactiveContainer.appendChild(createFamilyCard(name, inactiveFamilies[name]));
  }

  const inactiveSection = document.getElementById('inactiveSection');
  const hasInactive = Object.keys(inactiveFamilies).length > 0;
  if (inactiveSection) inactiveSection.style.display = hasInactive && !noDinnerActive ? 'block' : 'none';
}

async function init() {
  try {
    const data = await fetchAttendance();
    document.getElementById('titleDate').textContent = 'For: ' + formatDateDisplay(data.date);
    const parts = data.date.split('-');
    const monthNum = parseInt(parts[1], 10);
    const dayNum = parseInt(parts[2], 10);
    const shortMonths = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    document.getElementById('calMonth').textContent = shortMonths[monthNum - 1];
    document.getElementById('calDay').textContent = dayNum;
    document.getElementById('resetNote').textContent = 'Will RESET on ' + getResetFriday();
    isLocked = data.locked || false;
    noDinnerActive = data.noDinner || false;
    noDinnerMessage = data.noDinnerMessage || '';
    renderAllCards(data.families);
    updateTotal();
    applyLockState();
    applyNoDinnerState();
    applyAdminMode();

    const now = new Date();
    const options = { timeZone: 'America/New_York', year: '2-digit', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true };
    const timeFormatter = new Intl.DateTimeFormat('en-US', options);
    const timeParts = timeFormatter.formatToParts(now);
    const getPart = (type) => timeParts.find(p => p.type === type).value;
    const versionStr = getPart('month') + '/' + getPart('day') + '/' + getPart('year') + ' ' + getPart('hour') + ':' + getPart('minute') + getPart('dayPeriod').toLowerCase();
    document.getElementById('versionFooter').textContent = 'Version: ' + versionStr + ' Docker';
  } catch (error) {
    console.error('Failed to load attendance data:', error);
  }
}

let countdownSeconds = 300;
function updateCountdown() {
  const minutes = Math.floor(countdownSeconds / 60);
  const seconds = countdownSeconds % 60;
  document.getElementById('countdownTimer').textContent = minutes + 'm ' + seconds + 's';
  countdownSeconds--;
  if (countdownSeconds < 0) countdownSeconds = 300;
}

init();
updateCountdown();
setInterval(updateCountdown, 1000);

const eventSource = new EventSource(API_BASE + '/stream');
eventSource.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    document.getElementById('titleDate').textContent = 'For: ' + formatDateDisplay(data.date);
    const parts = data.date.split('-');
    const monthNum = parseInt(parts[1], 10);
    const dayNum = parseInt(parts[2], 10);
    const shortMonths = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    document.getElementById('calMonth').textContent = shortMonths[monthNum - 1];
    document.getElementById('calDay').textContent = dayNum;
    document.getElementById('resetNote').textContent = 'Will RESET on ' + getResetFriday();
    isLocked = data.locked || false;
    noDinnerActive = data.noDinner || false;
    noDinnerMessage = data.noDinnerMessage || '';
    renderAllCards(data.families);
    updateTotal();
    applyLockState();
    applyNoDinnerState();
    applyAdminMode();

    const now = new Date();
    const options = { timeZone: 'America/New_York', year: '2-digit', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true };
    const timeFormatter = new Intl.DateTimeFormat('en-US', options);
    const timeParts = timeFormatter.formatToParts(now);
    const getPart = (type) => timeParts.find(p => p.type === type).value;
    const versionStr = getPart('month') + '/' + getPart('day') + '/' + getPart('year') + ' ' + getPart('hour') + ':' + getPart('minute') + getPart('dayPeriod').toLowerCase();
    document.getElementById('versionFooter').textContent = 'Version: ' + versionStr + ' Docker';
  } catch (error) {
    console.error('Failed to process SSE data:', error);
  }
};
eventSource.onerror = () => { console.warn('SSE connection lost, will auto-reconnect...'); };

document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      countdownSeconds = 300;
      document.getElementById('countdownTimer').textContent = '5m 0s';
      const svg = refreshBtn.querySelector('svg');
      if (svg) { svg.classList.add('spinning'); init().finally(() => setTimeout(() => svg.classList.remove('spinning'), 500)); }
      else init();
    });
  }

  const homeBtn = document.getElementById('homeBtn');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => { window.location.href = 'https://dhofstra.com/LandingPage/'; });
  }

  const adminBtn = document.getElementById('adminBtn');
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      if (adminMode) { adminMode = false; applyAdminMode(); }
      else { if (!confirmPam('Enter Admin Mode')) return; adminMode = true; applyAdminMode(); }
    });
  }

  const lockBtn = document.getElementById('lockBtn');
  if (lockBtn) {
    lockBtn.addEventListener('click', async () => {
      const newLocked = !isLocked;
      try { const r = await updateLockState(newLocked); if (r.success) { isLocked = r.locked; applyLockState(); } }
      catch (e) { console.error(e); }
    });
  }

  const noDinnerBtn = document.getElementById('noDinnerBtn');
  if (noDinnerBtn) {
    noDinnerBtn.addEventListener('click', async () => {
      if (!noDinnerActive) {
        if (!confirm('This will hide all reservations and show a "No Dinner" message.\n\nAre you sure you want to cancel dinner this week?')) return;
      }
      const newNoDinner = !noDinnerActive;
      try {
        const message = newNoDinner ? noDinnerMessage : '';
        const r = await updateNoDinnerState(newNoDinner, message);
        if (r.success) { noDinnerActive = r.noDinner; noDinnerMessage = r.noDinnerMessage || ''; applyNoDinnerState(); }
      } catch (e) { console.error(e); }
    });
  }

  const addFamilyBtn = document.getElementById('addFamilyBtn');
  const addFamilyModal = document.getElementById('addFamilyModal');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const modalConfirmBtn = document.getElementById('modalConfirmBtn');
  const newFamilyName = document.getElementById('newFamilyName');
  const newFamilyCount = document.getElementById('newFamilyCount');

  function openAddFamilyModal() {
    if (addFamilyModal) { addFamilyModal.classList.add('active'); if (newFamilyName) { newFamilyName.value = ''; newFamilyName.focus(); } if (newFamilyCount) newFamilyCount.value = '2'; }
  }
  function closeAddFamilyModal() { if (addFamilyModal) addFamilyModal.classList.remove('active'); }

  if (addFamilyBtn) addFamilyBtn.addEventListener('click', openAddFamilyModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeAddFamilyModal);
  if (addFamilyModal) addFamilyModal.addEventListener('click', (e) => { if (e.target === addFamilyModal) closeAddFamilyModal(); });
  if (modalConfirmBtn && newFamilyName && newFamilyCount) {
    modalConfirmBtn.addEventListener('click', async () => {
      const name = newFamilyName.value.trim();
      if (!name) { alert('Please enter a name.'); return; }
      const count = parseInt(newFamilyCount.value, 10) || 2;
      try { const r = await adminAddFamily(name, count); if (r.success) closeAddFamilyModal(); else alert(r.error || 'Failed to add family'); }
      catch (e) { console.error(e); alert('Error adding family.'); }
    });
  }
  if (newFamilyName) newFamilyName.addEventListener('keydown', (e) => { if (e.key === 'Enter' && modalConfirmBtn) modalConfirmBtn.click(); });

  const overlayCloseBtn = document.getElementById('overlayCloseBtn');
  if (overlayCloseBtn) {
    overlayCloseBtn.addEventListener('click', async () => {
      if (!confirmPam('Turn off No-Dinner mode')) return;
      try { const r = await updateNoDinnerState(false, ''); if (r.success) { noDinnerActive = false; noDinnerMessage = ''; applyNoDinnerState(); } }
      catch (e) { console.error(e); }
    });
  }

  const overlayMessageInput = document.getElementById('overlayMessageInput');
  if (overlayMessageInput) {
    overlayMessageInput.addEventListener('blur', async () => {
      try { const r = await updateNoDinnerState(noDinnerActive, overlayMessageInput.value); if (r.success) noDinnerMessage = r.noDinnerMessage || ''; }
      catch (e) { console.error(e); }
    });
  }
});
