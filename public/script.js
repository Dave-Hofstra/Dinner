
// Use the current path prefix so it works both locally and behind nginx reverse proxy
// When at /Dinner/, prefix should be /Dinner. When at /, prefix should be empty.
const PATH_PREFIX = window.location.pathname.replace(/\/$/, '');
const API_BASE = (PATH_PREFIX === '' ? '' : PATH_PREFIX) + '/api/attendance';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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

function calculateTotal(families) {
  let total = 0;
  for (const name in families) {
    if (families[name].going) {
      total += families[name].count;
    }
  }
  return total;
}

function createFamilyCard(name, data) {
  const card = document.createElement('div');
  card.className = 'family-card' + (data.going ? ' going' : '');
  card.dataset.family = name;
  card.style.transition = 'order 0.5s ease, border-color 0.3s';

  const row1 = document.createElement('div');
  row1.className = 'card-row-1';

  const nameEl = document.createElement('div');
  nameEl.className = 'family-name';
  nameEl.textContent = name;

  const toggleContainer = document.createElement('div');
  toggleContainer.className = 'toggle-container';

  const notGoingLabel = document.createElement('span');
  notGoingLabel.className = 'toggle-label not-going' + (data.going ? '' : ' active');
  notGoingLabel.textContent = 'Not Going';

  const label = document.createElement('label');
  label.className = 'switch';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = data.going;

  const slider = document.createElement('span');
  slider.className = 'slider';

  label.appendChild(checkbox);
  label.appendChild(slider);

  const goingLabel = document.createElement('span');
  goingLabel.className = 'toggle-label going' + (data.going ? ' active' : '');
  goingLabel.textContent = 'Going';

  toggleContainer.appendChild(notGoingLabel);
  toggleContainer.appendChild(label);
  toggleContainer.appendChild(goingLabel);

  row1.appendChild(nameEl);
  row1.appendChild(toggleContainer);

  const commentRow = document.createElement('div');
  commentRow.className = 'card-comment-row';

  const commentInput = document.createElement('input');
  commentInput.type = 'text';
  commentInput.className = 'card-comment-input';
  commentInput.placeholder = 'Add Comments:';
  commentInput.value = data.comments || '';

  commentRow.appendChild(commentInput);

  const bottomSection = document.createElement('div');
  bottomSection.className = 'card-bottom';

  const row2 = document.createElement('div');
  row2.className = 'card-row-2';

  const selectLabel = document.createElement('span');
  selectLabel.className = 'number-label';
  selectLabel.textContent = 'Attending:';

  const zeroDisplay = document.createElement('span');
  zeroDisplay.className = 'attending-zero';
  zeroDisplay.textContent = '0';

  const select = document.createElement('select');
  select.className = 'number-select';
  for (let i = 1; i <= 6; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    if (i === data.count) {
      option.selected = true;
    }
    select.appendChild(option);
  }

  if (!data.going) {
    select.disabled = true;
    select.style.display = 'none';
    zeroDisplay.style.display = 'inline';
  } else {
    select.disabled = false;
    select.style.display = 'inline';
    zeroDisplay.style.display = 'none';
  }

  row2.appendChild(selectLabel);
  row2.appendChild(select);
  row2.appendChild(zeroDisplay);

  const row3 = document.createElement('div');
  row3.className = 'card-row-3';

  const lastMod = document.createElement('span');
  lastMod.className = 'last-modified';
  if (data.lastModified) {
    const ipParts = data.lastModified.ip.split('.');
    const shortIp = ipParts.slice(0, 2).join('.') + '.x.x';
    lastMod.textContent = '(' + shortIp + ' ' + formatLastModifiedTime(data.lastModified.time) + ')';
  }

  row3.appendChild(lastMod);

  bottomSection.appendChild(row2);
  bottomSection.appendChild(row3);

  card.appendChild(row1);
  card.appendChild(commentRow);
  card.appendChild(bottomSection);

  checkbox.addEventListener('change', async () => {
    const going = checkbox.checked;
    card.classList.toggle('going', going);
    notGoingLabel.classList.toggle('active', !going);
    goingLabel.classList.toggle('active', going);

    if (going) {
      const defaultCount = name === 'Kathy' ? 1 : 2;
      select.disabled = false;
      select.style.display = 'inline';
      zeroDisplay.style.display = 'none';
      select.value = defaultCount;
      await updateAttendance(name, { going: going, count: defaultCount });
    } else {
      select.disabled = true;
      select.style.display = 'none';
      zeroDisplay.style.display = 'inline';
      await updateAttendance(name, { going: going });
    }
    updateTotal();
  });

  select.addEventListener('change', async () => {
    const count = parseInt(select.value, 10);
    await updateAttendance(name, { count: count });
    updateTotal();
  });

  commentInput.addEventListener('blur', async () => {
    const comments = commentInput.value;
    await updateAttendance(name, { comments: comments });
  });

  return card;
}

function updateTotal() {
  const cards = document.querySelectorAll('.family-card');
  let total = 0;

  cards.forEach(card => {
    const checkbox = card.querySelector('.switch input');
    const select = card.querySelector('.number-select');
    if (checkbox.checked) {
      total += parseInt(select.value, 10);
    }
  });

  document.getElementById('totalCount').textContent = total;
  document.getElementById('badgeCount').textContent = total;
}

async function init() {
  try {
    const data = await fetchAttendance();
    document.getElementById('titleDate').textContent = 'For: ' + formatDateDisplay(data.date);

    const parts = data.date.split('-');
    const monthNum = parseInt(parts[1], 10);
    const dayNum = parseInt(parts[2], 10);
    const shortMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    document.getElementById('calMonth').textContent = shortMonths[monthNum - 1];
    document.getElementById('calDay').textContent = dayNum;

    document.getElementById('resetNote').textContent = 'Will RESET on ' + getResetFriday();

    const container = document.getElementById('cardsContainer');
    container.innerHTML = '';

    for (const name in data.families) {
      const card = createFamilyCard(name, data.families[name]);
      container.appendChild(card);
    }

    updateTotal();
  } catch (error) {
    console.error('Failed to load attendance data:', error);
  }
}

let countdownSeconds = 59;

function updateCountdown() {
  document.getElementById('countdownTimer').textContent = countdownSeconds + 's';
  countdownSeconds--;
  if (countdownSeconds < 0) {
    countdownSeconds = 59;
  }
}

init();
updateCountdown();

setInterval(init, 60000);
setInterval(updateCountdown, 1000);

document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      countdownSeconds = 59;
      document.getElementById('countdownTimer').textContent = '59s';
      const svg = refreshBtn.querySelector('svg');
      if (svg) {
        svg.classList.add('spinning');
        init().finally(() => {
          setTimeout(() => svg.classList.remove('spinning'), 500);
        });
      } else {
        init();
      }
    });
  }

  const homeBtn = document.getElementById('homeBtn');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      // Navigate to LandingPage - go up one level from /Dinner to root
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/Dinner')) {
        window.location.href = '/';
      } else {
        window.location.href = '/';
      }
    });
  }
});

(function() {
  const canvas = document.getElementById('golfCanvas');
  const ctx = canvas.getContext('2d');
  const strokeSpan = document.getElementById('strokeCount');
  const overlay = document.getElementById('golfOverlay');
  const closeBtn = document.getElementById('golfClose');
  const golfBtn = document.getElementById('golfBtn');

  const W = 600, H = 400;
  const course = { width: W, height: H, walls: [], obstacles: [], hole: { x:0, y:0, r: 12 }, start: { x:0, y:0 } };

  function generateCourse() {
    course.walls = [
      [0, 0, W, 0],
      [W, 0, W, H],
      [W, H, 0, H],
      [0, H, 0, 0]
    ];

    course.start.x = 40 + Math.random() * 80;
    course.start.y = 60 + Math.random() * 280;

    course.hole.x = 420 + Math.random() * 140;
    course.hole.y = 60 + Math.random() * 280;

    course.obstacles = [];

    const numWalls = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numWalls; i++) {
      let wall;
      let attempts = 0;
      do {
        const isHorizontal = Math.random() > 0.5;
        const len = 60 + Math.random() * 90;
        const x = 120 + Math.random() * 360;
        const y = 50 + Math.random() * 300;

        if (isHorizontal) {
          wall = [x, y, Math.min(x + len, 480), y];
        } else {
          wall = [x, y, x, Math.min(y + len, 350)];
        }
        attempts++;
      } while (attempts < 20 && isWallBlocking(wall));
      course.walls.push(wall);
    }

    const types = ['alligator', 'bird', 'turtle'];
    const numAnimals = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numAnimals; i++) {
      let obs;
      let attempts = 0;
      do {
        const type = types[Math.floor(Math.random() * types.length)];
        const x = 100 + Math.random() * 400;
        const y = 50 + Math.random() * 300;
        const angle = Math.random() * Math.PI * 2;
        if (type === 'alligator') {
          obs = { type, x, y, angle, length: 50 + Math.random() * 30, radius: 10 };
        } else if (type === 'bird') {
          obs = { type, x, y, radius: 14 };
        } else {
          obs = { type, x, y, radius: 18 };
        }
        attempts++;
      } while (attempts < 20 && isObstacleBlocking(obs));
      course.obstacles.push(obs);
    }
  }

  function isWallBlocking(wall) {
    const cx = (wall[0] + wall[2]) / 2;
    const cy = (wall[1] + wall[3]) / 2;
    const dStart = Math.sqrt((cx - course.start.x) ** 2 + (cy - course.start.y) ** 2);
    const dHole = Math.sqrt((cx - course.hole.x) ** 2 + (cy - course.hole.y) ** 2);
    return dStart < 60 || dHole < 60;
  }

  function isObstacleBlocking(obs) {
    const dStart = dist(obs.x, obs.y, course.start.x, course.start.y);
    const dHole = dist(obs.x, obs.y, course.hole.x, course.hole.y);
    return dStart < 60 || dHole < 60;
  }

  let ball = { x:0, y:0, vx:0, vy:0, r: 6 };
  let strokes = 0;
  let isDragging = false;
  let dragStart = { x:0, y:0 };
  let dragEnd = { x:0, y:0 };
  let isMoving = false;
  let gameWon = false;

  const FRICTION = 0.97;
  const MIN_SPEED = 0.3;
  const MAX_POWER = 12;
  const HOLE_RADIUS = course.hole.r;

  function resetGame() {
    ball.x = course.start.x;
    ball.y = course.start.y;
    ball.vx = 0;
    ball.vy = 0;
    strokes = 0;
    isMoving = false;
    gameWon = false;
    strokeSpan.textContent = '0';
  }

  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  function lineDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = dist(x1, y1, x2, y2);
    if (len === 0) return dist(px, py, x1, y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / (len * len);
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return dist(px, py, cx, cy);
  }

  function reflect(vx, vy, nx, ny) {
    const dot = vx * nx + vy * ny;
    return { vx: vx - 2 * dot * nx, vy: vy - 2 * dot * ny };
  }

  function getWallNormal(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    return { nx: -dy / len, ny: dx / len };
  }

  function updatePhysics() {
    if (!isMoving || gameWon) return;

    ball.vx *= FRICTION;
    ball.vy *= FRICTION;

    if (Math.abs(ball.vx) < MIN_SPEED && Math.abs(ball.vy) < MIN_SPEED) {
      ball.vx = 0;
      ball.vy = 0;
      isMoving = false;
      return;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    for (const w of course.walls) {
      const d = lineDist(ball.x, ball.y, w[0], w[1], w[2], w[3]);
      if (d < ball.r) {
        const n = getWallNormal(w[0], w[1], w[2], w[3]);
        const reflected = reflect(ball.vx, ball.vy, n.nx, n.ny);
        ball.vx = reflected.vx * 0.8;
        ball.vy = reflected.vy * 0.8;
        const push = ball.r - d + 0.5;
        ball.x += n.nx * push;
        ball.y += n.ny * push;
      }
    }

    for (const obs of course.obstacles) {
      if (obs.type === 'alligator') {
        const halfLen = obs.length / 2;
        const x1 = obs.x + Math.cos(obs.angle) * halfLen;
        const y1 = obs.y + Math.sin(obs.angle) * halfLen;
        const x2 = obs.x - Math.cos(obs.angle) * halfLen;
        const y2 = obs.y - Math.sin(obs.angle) * halfLen;
        const d = lineDist(ball.x, ball.y, x1, y1, x2, y2);
        if (d < ball.r + obs.radius) {
          const n = getWallNormal(x1, y1, x2, y2);
          const reflected = reflect(ball.vx, ball.vy, n.nx, n.ny);
          ball.vx = reflected.vx * 0.8;
          ball.vy = reflected.vy * 0.8;
          const push = ball.r + obs.radius - d + 0.5;
          ball.x += n.nx * push;
          ball.y += n.ny * push;
        }
      } else {
        const d = dist(ball.x, ball.y, obs.x, obs.y);
        if (d < ball.r + obs.radius) {
          const nx = (ball.x - obs.x) / d;
          const ny = (ball.y - obs.y) / d;
          const reflected = reflect(ball.vx, ball.vy, nx, ny);
          ball.vx = reflected.vx * 0.8;
          ball.vy = reflected.vy * 0.8;
          const push = ball.r + obs.radius - d + 0.5;
          ball.x += nx * push;
          ball.y += ny * push;
        }
      }
    }

    if (dist(ball.x, ball.y, course.hole.x, course.hole.y) < HOLE_RADIUS) {
      gameWon = true;
      isMoving = false;
      ball.vx = 0;
      ball.vy = 0;
    }
  }

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function onPointerDown(e) {
    e.preventDefault();
    if (gameWon) {
      generateCourse();
      ball.x = course.start.x;
      ball.y = course.start.y;
      resetGame();
      return;
    }
    if (isMoving) return;
    const pos = getCanvasPos(e);
    if (dist(pos.x, pos.y, ball.x, ball.y) < 30) {
      isDragging = true;
      dragStart = { x: pos.x, y: pos.y };
      dragEnd = { x: pos.x, y: pos.y };
    }
  }

  function onPointerMove(e) {
    e.preventDefault();
    if (!isDragging) return;
    const pos = getCanvasPos(e);
    dragEnd = { x: pos.x, y: pos.y };
  }

  function onPointerUp(e) {
    e.preventDefault();
    if (!isDragging) return;
    isDragging = false;

    const dx = dragStart.x - dragEnd.x;
    const dy = dragStart.y - dragEnd.y;
    const power = Math.min(dist(0, 0, dx, dy) / 15, MAX_POWER);

    if (power > 0.5) {
      ball.vx = dx / dist(0, 0, dx, dy) * power;
      ball.vy = dy / dist(0, 0, dx, dy) * power;
      isMoving = true;
      strokes++;
      strokeSpan.textContent = strokes;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#3a7a33';
    ctx.beginPath();
    ctx.ellipse(300, 200, 250, 160, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (const w of course.walls) {
      ctx.beginPath();
      ctx.moveTo(w[0], w[1]);
      ctx.lineTo(w[2], w[3]);
      ctx.stroke();
    }

    for (const obs of course.obstacles) {
      if (obs.type === 'alligator') drawAlligator(ctx, obs);
      else if (obs.type === 'bird') drawBird(ctx, obs);
      else if (obs.type === 'turtle') drawTurtle(ctx, obs);
    }

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(course.hole.x, course.hole.y, HOLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(course.hole.x, course.hole.y - HOLE_RADIUS);
    ctx.lineTo(course.hole.x, course.hole.y - HOLE_RADIUS - 30);
    ctx.stroke();
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(course.hole.x, course.hole.y - HOLE_RADIUS - 30);
    ctx.lineTo(course.hole.x + 15, course.hole.y - HOLE_RADIUS - 22);
    ctx.lineTo(course.hole.x, course.hole.y - HOLE_RADIUS - 14);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (isDragging) {
      const dx = dragStart.x - dragEnd.x;
      const dy = dragStart.y - dragEnd.y;
      const power = Math.min(dist(0, 0, dx, dy) / 15, MAX_POWER);
      const len = power * 15;

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + (dx / dist(0, 0, dx, dy)) * len, ball.y + (dy / dist(0, 0, dx, dy)) * len);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (gameWon) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f0c040';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Hole in ' + strokes + '!', canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillStyle = '#aaa';
      ctx.font = '16px sans-serif';
      ctx.fillText('Click to play again', canvas.width / 2, canvas.height / 2 + 30);
    }
  }

  function drawAlligator(ctx, obs) {
    const halfLen = obs.length / 2;
    const x1 = obs.x + Math.cos(obs.angle) * halfLen;
    const y1 = obs.y + Math.sin(obs.angle) * halfLen;
    const x2 = obs.x - Math.cos(obs.angle) * halfLen;
    const y2 = obs.y - Math.sin(obs.angle) * halfLen;

    // Body outline
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = obs.radius * 2 + 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Body fill
    ctx.strokeStyle = '#4a7c3f';
    ctx.lineWidth = obs.radius * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Snout outline
    const snoutX = x1 + Math.cos(obs.angle) * 8;
    const snoutY = y1 + Math.sin(obs.angle) * 8;
    ctx.fillStyle = '#1a3a1a';
    ctx.beginPath();
    ctx.moveTo(snoutX, snoutY);
    ctx.lineTo(snoutX + Math.cos(obs.angle + 0.8) * 10, snoutY + Math.sin(obs.angle + 0.8) * 10);
    ctx.lineTo(snoutX + Math.cos(obs.angle - 0.8) * 10, snoutY + Math.sin(obs.angle - 0.8) * 10);
    ctx.fill();

    // Snout fill
    ctx.fillStyle = '#4a7c3f';
    ctx.beginPath();
    ctx.moveTo(snoutX, snoutY);
    ctx.lineTo(snoutX + Math.cos(obs.angle + 0.8) * 8, snoutY + Math.sin(obs.angle + 0.8) * 8);
    ctx.lineTo(snoutX + Math.cos(obs.angle - 0.8) * 8, snoutY + Math.sin(obs.angle - 0.8) * 8);
    ctx.fill();

    // Eyes (two bumps on top)
    const eyeOff = 6;
    const perpX = -Math.sin(obs.angle);
    const perpY = Math.cos(obs.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(obs.x + perpX * eyeOff, obs.y + perpY * eyeOff, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(obs.x - perpX * eyeOff, obs.y - perpY * eyeOff, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(obs.x + perpX * eyeOff, obs.y + perpY * eyeOff, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(obs.x - perpX * eyeOff, obs.y - perpY * eyeOff, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Teeth (small white triangles along body)
    ctx.fillStyle = '#fff';
    for (let t = -0.3; t <= 0.3; t += 0.3) {
      const tx = obs.x + Math.cos(obs.angle) * t * obs.length;
      const ty = obs.y + Math.sin(obs.angle) * t * obs.length;
      ctx.beginPath();
      ctx.moveTo(tx + perpX * obs.radius, ty + perpY * obs.radius);
      ctx.lineTo(tx + perpX * (obs.radius + 4), ty + perpY * (obs.radius + 4));
      ctx.lineTo(tx + perpX * (obs.radius + 2), ty + perpY * (obs.radius + 2));
      ctx.fill();
    }
  }

  function drawBird(ctx, obs) {
    // Body
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.ellipse(obs.x, obs.y, obs.radius, obs.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = '#6B3410';
    ctx.beginPath();
    ctx.ellipse(obs.x - 2, obs.y - 3, obs.radius * 0.6, obs.radius * 0.4, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#FF8C00';
    ctx.beginPath();
    ctx.moveTo(obs.x + obs.radius, obs.y);
    ctx.lineTo(obs.x + obs.radius + 8, obs.y - 2);
    ctx.lineTo(obs.x + obs.radius + 8, obs.y + 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(obs.x + obs.radius * 0.5, obs.y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(obs.x + obs.radius * 0.5, obs.y - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTurtle(ctx, obs) {
    // Shell (dome)
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, obs.radius, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#1B5E20';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Shell pattern (hexagon lines)
    ctx.strokeStyle = '#1B5E20';
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      const sx = obs.x + i * obs.radius * 0.4;
      const sy = obs.y - obs.radius * 0.3;
      ctx.beginPath();
      ctx.arc(sx, sy, obs.radius * 0.35, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // Head
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(obs.x + obs.radius * 0.7, obs.y + 2, 6, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(obs.x + obs.radius * 0.7 + 2, obs.y, 2, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#4CAF50';
    const legPositions = [
      [obs.x - obs.radius * 0.5, obs.y + obs.radius * 0.3],
      [obs.x + obs.radius * 0.3, obs.y + obs.radius * 0.3],
      [obs.x - obs.radius * 0.5, obs.y - obs.radius * 0.3],
      [obs.x + obs.radius * 0.3, obs.y - obs.radius * 0.3]
    ];
    for (const [lx, ly] of legPositions) {
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function gameLoop() {
    updatePhysics();
    draw();
    requestAnimationFrame(gameLoop);
  }


  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('mouseleave', (e) => {
    if (isDragging) {
      isDragging = false;
    }
  });

  canvas.addEventListener('touchstart', onPointerDown, { passive: false });
  canvas.addEventListener('touchmove', onPointerMove, { passive: false });
  canvas.addEventListener('touchend', onPointerUp, { passive: false });

  golfBtn.addEventListener('click', () => {
    generateCourse();
    ball.x = course.start.x;
    ball.y = course.start.y;
    overlay.classList.add('active');
    resetGame();
  });

  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('active');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });

  gameLoop();
})();
