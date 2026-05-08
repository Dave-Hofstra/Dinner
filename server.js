const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'attendance.json');

// Mount everything under /Dinner so it works behind the nginx reverse proxy
const router = express.Router();

router.use(express.json());
router.use(express.static(path.join(__dirname, 'public')));

const FAMILIES = [
  "Gord & Steph",
  "Pam & Chuck",
  "Wendy & Phil",
  "Elaine & Joe",
  "Kathy",
  "Cyndi & Paul",
  "Dave & Donna",
  "Kenny & Kathy"
];

function getDefaultData() {
  const families = {};
  FAMILIES.forEach(name => {
    families[name] = { going: false, count: name === "Kathy" ? 1 : 2, comments: "", lastModified: null };
  });
  return { families };
}

function getNextThursday() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  let daysUntilThursday;
  
  if (day === 5 || day === 6 || day === 0) {
    // Friday, Saturday, Sunday -> next Thursday
    daysUntilThursday = (4 - day + 7) % 7;
    if (daysUntilThursday === 0) daysUntilThursday = 7;
  } else {
    // Monday through Thursday
    daysUntilThursday = (4 - day + 7) % 7;
    if (daysUntilThursday === 0) daysUntilThursday = 0; // Today is Thursday
  }

  const nextThu = new Date(now);
  nextThu.setDate(now.getDate() + daysUntilThursday);
  nextThu.setHours(0, 0, 0, 0);
  return nextThu;
}

function getWeekKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getEasternTimeISO() {
  // Get current time in Eastern Time (America/Indianapolis == Eastern)
  const now = new Date();
  const options = {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  
  const getPart = (type) => parts.find(p => p.type === type).value;
  
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading data file:', e);
  }
  return null;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getOrInitData() {
  const currentWeekKey = getWeekKey(getNextThursday());
  let data = loadData();

  if (!data || data.weekOf !== currentWeekKey) {
    // New week or no data - reset (lastModified gets reset too since we use fresh defaults)
    data = getDefaultData();
    data.weekOf = currentWeekKey;
    saveData(data);
  }

  return data;
}

function getClientIP(req) {
  // Check x-forwarded-for header set by nginx, fallback to req.ip
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection.remoteAddress;
}

// GET /api/attendance - returns current attendance data
router.get('/api/attendance', (req, res) => {
  const data = getOrInitData();
  const nextThu = getNextThursday();
  res.json({
    weekOf: data.weekOf,
    date: nextThu.toISOString().split('T')[0],
    families: data.families
  });
});

// POST /api/attendance - updates attendance data
router.post('/api/attendance', (req, res) => {
  const data = getOrInitData();
  const { family, going, count, comments } = req.body;

  if (!family || !data.families[family]) {
    return res.status(400).json({ error: 'Invalid family name' });
  }

  if (going !== undefined) {
    data.families[family].going = going;
  }
  if (count !== undefined) {
    const c = parseInt(count, 10);
    if (c >= 1 && c <= 6) {
      data.families[family].count = c;
    }
  }
  if (comments !== undefined) {
    data.families[family].comments = comments;
  }

  // Record last modified info
  const ip = getClientIP(req);
  data.families[family].lastModified = {
    ip: ip,
    time: getEasternTimeISO()
  };

  saveData(data);
  res.json({ success: true, families: data.families });
});

// Mount the router at /Dinner
app.use('/Dinner', router);

// Also handle direct access (without /Dinner prefix) for local testing
app.use('/', router);

app.listen(PORT, () => {
  console.log(`Dinner Attendance server running on port ${PORT}`);
});