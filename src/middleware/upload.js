const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const dir = path.join(__dirname, "../../uploads");
fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: dir,
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname).toLowerCase()}`),
});

const fileFilter = (req, file, cb) => {
  if (/^(image|video)\//.test(file.mimetype)) return cb(null, true);
  cb(Object.assign(new Error("Hanya file foto/video yang diperbolehkan"), { status: 400 }));
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024, files: 10 } });
