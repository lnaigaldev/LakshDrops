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

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("files.json")) fs.writeFileSync("files.json", "[]");

const storage = multer.diskStorage({
  destination: "uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// 📤 Upload file
app.post("/upload", upload.single("file"), (req, res) => {
  const { accessKey } = req.body;
  if (!accessKey) return res.status(400).json({ error: "Access key required" });

  const files = JSON.parse(fs.readFileSync("files.json"));
  files.push({
    id: uuid(),
    name: req.file.originalname,
    path: req.file.path,
    key: accessKey,
    uploadedAt: new Date().toISOString()
  });

  fs.writeFileSync("files.json", JSON.stringify(files, null, 2));
  res.json({ message: "Uploaded successfully" });
});

// 📄 List files
app.get("/files", (req, res) => {
  const files = JSON.parse(fs.readFileSync("files.json"));
  res.json(files.map(f => ({ id: f.id, name: f.name })));
});

// 🔐 Download file
app.post("/download/:id", (req, res) => {
  const { key } = req.body;
  const files = JSON.parse(fs.readFileSync("files.json"));
  const file = files.find(f => f.id === req.params.id);

  if (!file) return res.status(404).json({ error: "File not found" });
  if (file.key !== key) return res.status(403).json({ error: "Wrong key" });

  res.download(path.resolve(file.path), file.name);
});

// 🗑 Admin delete
app.post("/admin/delete/:id", (req, res) => {
  if (req.headers["admin-key"] !== ADMIN_KEY)
    return res.status(403).json({ error: "Unauthorized" });

  let files = JSON.parse(fs.readFileSync("files.json"));
  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: "Not found" });

  fs.unlinkSync(file.path);
  files = files.filter(f => f.id !== req.params.id);
  fs.writeFileSync("files.json", JSON.stringify(files, null, 2));

  res.json({ message: "Deleted" });
});

app.listen(PORT, () => console.log("LakshDrops running on", PORT));
