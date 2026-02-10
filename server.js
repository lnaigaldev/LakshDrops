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
const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
  const { accessKey } = req.body;
  if (!accessKey) return res.status(400).json({ error: "Key required" });

  const files = readFiles();
  files.push({
    id: uuid(),
    name: req.file.originalname,
    path: req.file.path,
    key: accessKey
  });

  fs.writeFileSync("files.json", JSON.stringify(files, null, 2));
  res.json({ success: true });
});

app.get("/files", (_, res) => {
  const files = readFiles();
  res.json(files.map(f => ({ id: f.id, name: f.name })));
});

app.post("/download/:id", (req, res) => {
  const { key } = req.body;
  const file = readFiles().find(f => f.id === req.params.id);

  if (!file) return res.sendStatus(404);
  if (file.key !== key) return res.sendStatus(403);

  res.download(path.resolve(file.path), file.name);
});

app.post("/admin/delete/:id", (req, res) => {
  if (req.headers["admin-key"] !== ADMIN_KEY)
    return res.sendStatus(403);

  let files = readFiles();
  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.sendStatus(404);

  fs.unlinkSync(file.path);
  files = files.filter(f => f.id !== req.params.id);
  fs.writeFileSync("files.json", JSON.stringify(files, null, 2));
  res.json({ deleted: true });
});

app.listen(PORT, () =>
  console.log("LakshDrops running on", PORT)
);
