import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import fileType from "file-type";
const { fileTypeFromFile } = fileType;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Only these are accepted, and only once the file's actual bytes confirm it —
// a client can set any Content-Type header it likes on a multipart part, so
// that header alone (what this code used to rely on) is not trustworthy.
// SVG is deliberately excluded: it can embed <script> and is a stored-XSS
// vector even when only ever used inside an <img> tag by our own frontend,
// because the raw file is also reachable directly via /uploads/....
const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function makeUploader(subfolder) {
  const dir = path.join(__dirname, "..", "..", "uploads", subfolder);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    // Never trust the client's filename/extension for the name we save under —
    // generate our own. The real extension is fixed up after content sniffing,
    // in the validateUploadedFile middleware below.
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}.tmp`),
  });

  function fileFilter(req, file, cb) {
    // Cheap first-pass rejection on the declared type. The real check happens
    // after upload, against actual file bytes, in validateUploadedFile.
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  }

  return multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
}

// Runs after multer has saved the file to disk. Sniffs the real content,
// rejects anything not on the whitelist (deleting the upload), and renames
// the file to carry the extension that matches its actual detected type.
function validateUploadedFile(req, res, next) {
  if (!req.file) return next();

  const cleanup = () => fs.unlink(req.file.path, () => {});

  fileTypeFromFile(req.file.path)
    .then((detected) => {
      const ext = detected && ALLOWED_TYPES[detected.mime];
      if (!ext) {
        cleanup();
        return res.status(400).json({ error: "File content does not match an allowed image type (jpg, png, webp)" });
      }
      const finalPath = req.file.path.replace(/\.tmp$/, ext);
      fs.rename(req.file.path, finalPath, (err) => {
        if (err) {
          cleanup();
          return res.status(500).json({ error: "Failed to process uploaded file" });
        }
        req.file.filename = path.basename(finalPath);
        req.file.path = finalPath;
        next();
      });
    })
    .catch(() => {
      cleanup();
      res.status(400).json({ error: "Could not read uploaded file" });
    });
}

export const uploadProductImage = {
  single: (field) => [makeUploader("products").single(field), validateUploadedFile],
};

// Store logo — printed at the top of every receipt (see Settings > Store branding).
export const uploadStoreLogo = {
  single: (field) => [makeUploader("store").single(field), validateUploadedFile],
};