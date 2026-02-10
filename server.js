const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "admin123";

app.use(express.json());
app.use(express.static("public"));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync("files.json")) fs.writeFileSync("files.json", "[]");

function readFiles() {
  try {
    return JSON.parse(fs.readFileSync("files.json"));
  } catch {
    return [];
  }
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

app.post("/upload", upload.single("file"), (req, res) => {
  const { accessKey, uploader } = req.body; // 👈 added uploader
  if (!accessKey) return res.status(400).json({ error: "Key required" });

  const files = readFiles();
  files.push({
    id: uuid(),
    name: req.file.originalname,
    path: req.file.path,
    key: accessKey,
    uploader: uploader || "Anonymous" // 👈 optional uploader
  });

  fs.writeFile("files.json", JSON.stringify(files, null, 2), (err) => {
    if (err) return res.status(500).json({ error: "Upload failed" });
    res.json({ success: true });
  });
});

app.get("/files", (_, res) => {
  const files = readFiles();
  res.json(
    files.map(f => ({
      id: f.id,
      name: f.name,
      uploader: f.uploader // 👈 exposed to frontend
    }))
  );
});

app.post("/download/:id", (req, res) => {
  const { key } = req.body;
  const file = readFiles().find(f => f.id === req.params.id);

  if (!file) return res.sendStatus(404);
  if (file.key !== key) return res.sendStatus(403);

  res.download(path.resolve(file.path), file.name); // filename preserved ✅
});

app.post("/admin/delete/:id", (req, res) => {
  if (req.headers["admin-key"] !== ADMIN_KEY)
    return res.sendStatus(403);

  let files = readFiles();
  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.sendStatus(404);

  fs.unlink(file.path, (err) => {
    if (err) console.error("Error deleting file:", err);
    files = files.filter(f => f.id !== req.params.id);
    fs.writeFile("files.json", JSON.stringify(files, null, 2), (err) => {
      if (err) return res.status(500).json({ error: "Delete failed" });
      res.json({ deleted: true });
    });
  });
});

app.listen(PORT, () =>
  console.log("LakshDrops running on", PORT)
);
