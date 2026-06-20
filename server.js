const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "data", "attendance.json");

const router = express.Router();
router.use(express.json());
router.use(express.static(path.join(__dirname, "public")));

const DEFAULT_FAMILIES = [
  "Kathy",
  "Pam & Chuck",
  "Wendy & Phil",
  "Elaine & Joe",
  "Gord & Steph",
  "Cyndi & Paul",
  "Dave & Donna",
  "Kenny & Kathy",
];

function getDefaultData() {
  const families = {};
  DEFAULT_FAMILIES.forEach((name) => {
    families[name] = {
      going: false,
      count: name === "Kathy" ? 1 : 2,
      comments: "",
      lastModified: null,
      active: true,
    };
  });
  return { families, locked: false, noDinner: false, noDinnerMessage: "" };
}

function getNextThursday() {
  const now = new Date();
  const day = now.getDay();
  let daysUntilThursday;
  if (day === 5 || day === 6 || day === 0) {
    daysUntilThursday = (4 - day + 7) % 7;
    if (daysUntilThursday === 0) daysUntilThursday = 7;
  } else {
    daysUntilThursday = (4 - day + 7) % 7;
    if (daysUntilThursday === 0) daysUntilThursday = 0;
  }
  const nextThu = new Date(now);
  nextThu.setDate(now.getDate() + daysUntilThursday);
  nextThu.setHours(0, 0, 0, 0);
  return nextThu;
}

function getWeekKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getEasternTimeISO() {
  const now = new Date();
  const options = {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(now);
  const getPart = (type) => parts.find((p) => p.type === type).value;
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading data file:", e);
  }
  return null;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function getOrInitData() {
  const currentWeekKey = getWeekKey(getNextThursday());
  let data = loadData();

  if (!data || data.weekOf !== currentWeekKey) {
    const oldInactive = {};
    if (data && data.families) {
      for (const [name, info] of Object.entries(data.families)) {
        if (info.active === false) {
          oldInactive[name] = {
            going: false,
            count: info.count || 2,
            comments: info.comments || "",
            lastModified: null,
            active: false,
          };
        }
      }
    }
    data = getDefaultData();
    data.weekOf = currentWeekKey;
    for (const [name, info] of Object.entries(oldInactive)) {
      if (!data.families[name]) {
        data.families[name] = info;
      }
    }
    saveData(data);
  } else {
    let changed = false;
    for (const info of Object.values(data.families)) {
      if (info.active === undefined) { info.active = true; changed = true; }
    }
    if (data.locked === undefined) { data.locked = false; changed = true; }
    if (data.noDinner === undefined) { data.noDinner = false; changed = true; }
    if (data.noDinnerMessage === undefined) { data.noDinnerMessage = ""; changed = true; }
    if (changed) saveData(data);
  }
  return data;
}

function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.ip || req.connection.remoteAddress;
}

const sseClients = [];

function broadcastData() {
  const data = getOrInitData();
  const nextThu = getNextThursday();
  const payload = JSON.stringify({
    weekOf: data.weekOf,
    date: nextThu.toISOString().split("T")[0],
    families: data.families,
    locked: data.locked || false,
    noDinner: data.noDinner || false,
    noDinnerMessage: data.noDinnerMessage || "",
  });
  sseClients.forEach((res) => res.write(`data: ${payload}\n\n`));
}

router.get("/api/attendance/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const data = getOrInitData();
  const nextThu = getNextThursday();
  const payload = JSON.stringify({
    weekOf: data.weekOf,
    date: nextThu.toISOString().split("T")[0],
    families: data.families,
    locked: data.locked || false,
    noDinner: data.noDinner || false,
    noDinnerMessage: data.noDinnerMessage || "",
  });
  res.write(`data: ${payload}\n\n`);
  sseClients.push(res);
  req.on("close", () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

router.get("/api/attendance", (req, res) => {
  const data = getOrInitData();
  const nextThu = getNextThursday();
  res.json({
    weekOf: data.weekOf,
    date: nextThu.toISOString().split("T")[0],
    families: data.families,
    locked: data.locked || false,
    noDinner: data.noDinner || false,
    noDinnerMessage: data.noDinnerMessage || "",
  });
});

router.post("/api/attendance", (req, res) => {
  const data = getOrInitData();
  const { family, going, count, comments } = req.body;
  if (!family || !data.families[family]) {
    return res.status(400).json({ error: "Invalid family name" });
  }
  if (going !== undefined) data.families[family].going = going;
  if (count !== undefined) {
    const c = parseInt(count, 10);
    if (c >= 1 && c <= 6) data.families[family].count = c;
  }
  if (comments !== undefined) data.families[family].comments = comments;
  const ip = getClientIP(req);
  data.families[family].lastModified = { ip, time: getEasternTimeISO() };
  saveData(data);
  broadcastData();
  res.json({ success: true, families: data.families });
});

router.post("/api/attendance/lock", (req, res) => {
  const data = getOrInitData();
  const { locked } = req.body;
  if (locked !== undefined) { data.locked = !!locked; saveData(data); }
  broadcastData();
  res.json({ success: true, locked: data.locked });
});

router.post("/api/attendance/no-dinner", (req, res) => {
  const data = getOrInitData();
  const { noDinner, message } = req.body;
  if (noDinner !== undefined) data.noDinner = !!noDinner;
  if (message !== undefined) data.noDinnerMessage = message;
  saveData(data);
  broadcastData();
  res.json({ success: true, noDinner: data.noDinner, noDinnerMessage: data.noDinnerMessage });
});

// Admin endpoints
router.post("/api/attendance/admin/add-family", (req, res) => {
  const data = getOrInitData();
  const { name, count } = req.body;
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "Valid family name required" });
  }
  const trimmedName = name.trim();
  if (data.families[trimmedName]) {
    return res.status(400).json({ error: "Family already exists" });
  }
  const defaultCount = parseInt(count, 10);
  const safeCount = !isNaN(defaultCount) && defaultCount >= 1 && defaultCount <= 6 ? defaultCount : 2;
  data.families[trimmedName] = {
    going: false, count: safeCount, comments: "", lastModified: null, active: true,
  };
  saveData(data);
  broadcastData();
  res.json({ success: true, families: data.families });
});

router.post("/api/attendance/admin/toggle-active", (req, res) => {
  const data = getOrInitData();
  const { name } = req.body;
  if (!name || !data.families[name]) {
    return res.status(400).json({ error: "Invalid family name" });
  }
  data.families[name].active = !data.families[name].active;
  if (data.families[name].active) {
    data.families[name].going = false;
    data.families[name].lastModified = null;
  }
  saveData(data);
  broadcastData();
  res.json({ success: true, families: data.families });
});

// POST /api/attendance/admin/delete-family - deletes a family
router.post("/api/attendance/admin/delete-family", (req, res) => {
  const data = getOrInitData();
  const { name } = req.body;
  if (!name || !data.families[name]) {
    return res.status(400).json({ error: "Invalid family name" });
  }
  // Don't allow deleting default families
  if (DEFAULT_FAMILIES.includes(name)) {
    return res.status(400).json({ error: "Cannot delete a default family" });
  }
  delete data.families[name];
  saveData(data);
  broadcastData();
  res.json({ success: true, families: data.families });
});

app.use("/Dinner", router);
app.use("/", router);

app.listen(PORT, () => {
  console.log(`Dinner Attendance server running on port ${PORT}`);
});
