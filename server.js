const express = require("express");
const multer = require("multer");
const { v4: uuid } = require("uuid");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;
const ADMIN_KEY = "admin123";

/* ---------- MIDDLEWARE ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // IMPORTANT
app.use(express.static("public"));

/* ---------- UPLOADS FOLDER ---------- */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

/* ---------- MULTER CONFIG ---------- */
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, uuid() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

/* ---------- IN-MEMORY STORE ---------- */
let files = [];

/* ---------- UPLOAD ---------- */
app.post("/upload", upload.single("file"), (req, res) => {
  const { uploader, description, key } = req.body;

  if (!req.file || !key) {
    return res.status(400).json({ error: "File and key required" });
  }

  const fileData = {
    id: uuid(),
    name: req.file.originalname,
    path: path.join(uploadDir, req.file.filename), // ABSOLUTE SAFE PATH
    uploader,
    description,
    key
  };

  files.push(fileData);
  res.json({ success: true, id: fileData.id });
});

/* ---------- LIST FILES ---------- */
app.get("/files", (req, res) => {
  res.json(
    files.map(f => ({
      id: f.id,
      name: f.name,
      uploader: f.uploader,
      description: f.description
    }))
  );
});

/* ---------- USER DOWNLOAD ---------- */
app.post("/download/:id", (req, res) => {
  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.status(404).send("File not found");

  if (!req.body.key || req.body.key !== file.key) {
    return res.status(403).send("Invalid key");
  }

  if (!fs.existsSync(file.path)) {
    return res.status(404).send("File missing on server");
  }

  res.download(file.path, file.name);
});

/* ---------- ADMIN DOWNLOAD ---------- */
app.get("/admin/download/:id", (req, res) => {
  if (req.headers["admin-key"] !== ADMIN_KEY) {
    return res.status(403).send("Unauthorized");
  }

  const file = files.find(f => f.id === req.params.id);
  if (!file) return res.status(404).send("File not found");

  if (!fs.existsSync(file.path)) {
    return res.status(404).send("File missing on server");
  }

  res.download(file.path, file.name);
});

/* ---------- ADMIN DELETE ---------- */
app.post("/admin/delete/:id", (req, res) => {
  if (req.headers["admin-key"] !== ADMIN_KEY) {
    return res.status(403).send("Unauthorized");
  }

  const index = files.findIndex(f => f.id === req.params.id);
  if (index === -1) return res.status(404).send("File not found");

  if (fs.existsSync(files[index].path)) {
    fs.unlinkSync(files[index].path);
  }

  files.splice(index, 1);
  res.sendStatus(200);
});

/* ---------- START SERVER ---------- */
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
