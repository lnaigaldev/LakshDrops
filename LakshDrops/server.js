const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ENV KEYS
const UPLOAD_KEYS = (process.env.UPLOAD_KEYS || "").split(",").filter(Boolean);
const ADMIN_KEY = process.env.ADMIN_KEY;

// DIRECTORIES
const UPLOAD_DIR = "uploads";
const DB_FILE = "files.json";

// HELPERS
function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function genKey(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}

// MIDDLEWARE
app.use(express.json());
app.use(express.static("public"));

// AUTH
function checkUploadKey(req, res, next) {
  const key = req.headers["x-upload-key"];
  if (!key || !UPLOAD_KEYS.includes(key)) {
    return res.status(401).json({ error: "Invalid upload key" });
  }
  next();
}

function checkAdminKey(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!key || key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

// MULTER
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// UPLOAD
app.post("/upload", checkUploadKey, upload.single("file"), (req, res) => {
  const db = readDB();

  const fileId = genKey(8);
  const downloadKey = genKey(16);

  db[fileId] = {
    storedName: req.file.filename,
    originalName: req.file.originalname,
    downloadKey,
    uploadedAt: Date.now()
  };

  writeDB(db);

  const downloadUrl =
    `${req.protocol}://${req.get("host")}` +
    `/download/${fileId}?key=${downloadKey}`;

  res.json({ fileId, downloadKey, downloadUrl });
});

// DOWNLOAD (SECURE)
app.get("/download/:id", (req, res) => {
  const db = readDB();
  const file = db[req.params.id];

  if (!file) return res.status(404).send("File not found");
  if (file.downloadKey !== req.query.key)
    return res.status(403).send("Invalid download key");

  res.download(
    path.join(UPLOAD_DIR, file.storedName),
    file.originalName
  );
});

// ADMIN: LIST FILES
app.get("/admin/files", checkAdminKey, (req, res) => {
  res.json(readDB());
});

// ADMIN: DELETE FILE
app.delete("/admin/files/:id", checkAdminKey, (req, res) => {
  const db = readDB();
  const file = db[req.params.id];

  if (!file) return res.status(404).json({ error: "Not found" });

  fs.unlinkSync(path.join(UPLOAD_DIR, file.storedName));
  delete db[req.params.id];
  writeDB(db);

  res.json({ success: true });
});

// START
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
