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

// --------- Multer Config ---------
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, uuid() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// --------- Data Store ---------
let files = [];
let adminEmails = [OWNER_EMAIL]; // Owner is initial admin

// --------- Upload Endpoint ---------
app.post("/upload", upload.single("file"), (req, res) => {
  const { uploader, description, key } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }
  if (!uploader || !description || !key) {
    return res.status(400).json({ error: "Missing uploader, description, or key." });
  }
  const keyStr = String(key).trim();
  if (!/^[0-9]{4}$/.test(keyStr)) {
    return res.status(400).json({ error: "Key must be a 4-digit number." });
  }

  const fileData = {
    id: uuid(),
    name: req.file.originalname,
    path: req.file.path,
    uploader,
    description,
    key: keyStr,
  };

  files.push(fileData);
  res.json({ success: true, id: fileData.id });
});

// --------- List Files ---------
app.get("/files", (req, res) => {
  res.json(
    files.map((f) => ({
      id: f.id,
      name: f.name,
      uploader: f.uploader,
      description: f.description,
    }))
  );
});

// --------- User Download Endpoint ---------
app.post("/download/:id", (req, res) => {
  const file = files.find((f) => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: "File not found" });

  const userEmail = req.body.email;
  if (adminEmails.includes(userEmail)) {
    // Admin - keyless download
    return res.download(file.path, file.name);
  }

  const reqKey = String(req.body.key || "").trim();
  const storedKey = String(file.key).trim();

  if (!/^[0-9]{4}$/.test(reqKey)) {
    return res.status(400).json({ error: "Key must be a 4-digit number." });
  }
  if (reqKey !== storedKey) {
    return res.status(403).json({ error: "Invalid key. Please check your 4-digit code." });
  }

  res.download(file.path, file.name);
});

// --------- Admin Download Endpoint ---------
app.post("/admin/download/:id", (req, res) => {
  const file = files.find((f) => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: "File not found" });

  const userEmail = req.body.email;
  if (adminEmails.includes(userEmail)) {
    return res.download(file.path, file.name);
  }
  return res.status(403).json({ error: "Forbidden: Only admins can download without a key." });
});

// --------- Add Admin (Owner Only) ---------
app.post("/addAdmin", (req, res) => {
  const { ownerEmail, newAdminEmail } = req.body;
  if (ownerEmail !== OWNER_EMAIL) {
    return res.status(403).json({ error: "Forbidden: Only owner can add admins." });
  }
  if (!newAdminEmail || typeof newAdminEmail !== "string") {
    return res.status(400).json({ error: "Invalid admin email." });
  }
  if (!adminEmails.includes(newAdminEmail)) {
    adminEmails.push(newAdminEmail);
  }
  res.json({ success: true, admins: adminEmails });
});

// --------- Admin Delete File ---------
app.post("/admin/delete/:id", (req, res) => {
  const userEmail = req.body.email;
  if (!adminEmails.includes(userEmail)) {
    return res.status(403).json({ error: "Forbidden: Only admins can delete files." });
  }
  const index = files.findIndex((f) => f.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "File not found" });

  fs.unlinkSync(files[index].path);
  files.splice(index, 1);

  res.json({ success: true });
});

// --------- Start Server ---------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});