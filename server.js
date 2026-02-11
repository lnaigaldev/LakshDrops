const express = require("express");
const multer = require("multer");
const { v4: uuid } = require("uuid");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;
const OWNER_EMAIL = "lnaigaldev@gmail.com";

app.use(express.json());
app.use(express.static("public"));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// ---------------- MULTER ----------------
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, uuid() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ---------------- DATA STORE ----------------
let files = [];
let adminEmails = [OWNER_EMAIL]; // Start with owner as initial admin

// ---------------- UPLOAD ----------------
app.post("/upload", upload.single("file"), (req, res) => {
  const { uploader, description, key } = req.body;

  // Validate key is a 4-digit number (string or number)
  const keyStr = String(key).trim();
  if (!/^[0-9]{4}$/.test(keyStr)) {
    return res.status(400).send("Key must be a 4-digit number.");
  }

  const fileData = {
    id: uuid(),
    name: req.file.originalname,
    path: req.file.path,
    uploader,
    description,
    key: keyStr
  };

  files.push(fileData);
  res.json({ success: true, id: fileData.id });
});

// ---------------- LIST FILES ----------------
app.get("/files", (req, res) => {
  res.json(files.map(f => ({
    id: f.id,
    name: f.name,
    uploader: f.uploader,
    description: f.description
  })));
});

// ---------------- USER DOWNLOAD ----------------
app.post("/download/:id", (req, res) => {
  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.sendStatus(404);

  const userEmail = req.body.email;
  if (adminEmails.includes(userEmail)) {
    // Admin: bypass key check
    return res.download(file.path, file.name);
  }

  // Validate and compare keys
  const reqKey = String(req.body.key).trim();
  const storedKey = String(file.key).trim();
  if (!/^[0-9]{4}$/.test(reqKey)) {
    return res.status(400).send("Key must be a 4-digit number.");
  }
  if (reqKey !== storedKey) {
    return res.status(403).send("Invalid key. Please check your 4-digit code.");
  }

  res.download(file.path, file.name);
});

// ---------------- ADMIN DOWNLOAD ----------------
app.post("/admin/download/:id", (req, res) => {
  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.sendStatus(404);

  const userEmail = req.body.email;
  if (adminEmails.includes(userEmail)) {
    return res.download(file.path, file.name);
  }
  // If not admin
  return res.status(403).send("Forbidden: Only admins can download without a key.");
});

// ---------------- ADD ADMIN (OWNER ONLY) ----------------
app.post("/addAdmin", (req, res) => {
  const { ownerEmail, newAdminEmail } = req.body;
  if (ownerEmail !== OWNER_EMAIL) {
    return res.status(403).send("Forbidden: Only owner can add admins.");
  }
  if (!newAdminEmail || typeof newAdminEmail !== "string") {
    return res.status(400).send("Invalid admin email.");
  }
  if (!adminEmails.includes(newAdminEmail)) {
    adminEmails.push(newAdminEmail);
  }
  res.json({ success: true, admins: adminEmails });
});

// ---------------- ADMIN DELETE ----------------
app.post("/admin/delete/:id", (req, res) => {
  const userEmail = req.body.email;
  if (!adminEmails.includes(userEmail)) {
    return res.sendStatus(403);
  }

  const index = files.findIndex(f => f.id === req.params.id);
  if (index === -1) return res.sendStatus(404);

  fs.unlinkSync(files[index].path);
  files.splice(index, 1);

  res.sendStatus(200);
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});