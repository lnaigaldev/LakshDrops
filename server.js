const express = require("express");
const multer = require("multer");
const { v4: uuid } = require("uuid");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;
const ADMIN_KEY = "admin123";

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

// ---------------- UPLOAD ----------------
app.post("/upload", upload.single("file"), (req, res) => {
  const { uploader, description, key } = req.body;

  const fileData = {
    id: uuid(),
    name: req.file.originalname,
    path: req.file.path,
    uploader,
    description,
    key
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

  if (req.body.key !== file.key) {
    return res.status(403).send("Invalid key");
  }

  res.download(file.path, file.name);
});

// ---------------- ADMIN DOWNLOAD ----------------
app.get("/admin/download/:id", (req, res) => {
  if (req.headers["admin-key"] !== ADMIN_KEY) {
    return res.sendStatus(403);
  }

  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.sendStatus(404);

  const absolutePath = path.resolve(file.path);
res.download(absolutePath, file.name);

});

// ---------------- ADMIN DELETE ----------------
app.post("/admin/delete/:id", (req, res) => {
  if (req.headers["admin-key"] !== ADMIN_KEY) {
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
