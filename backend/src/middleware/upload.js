import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeUploader(subfolder) {
  const dir = path.join(__dirname, "..", "..", "uploads", subfolder);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });

  function fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  }

  return multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
}

export const uploadProductImage = makeUploader("products");

// Store logo — printed at the top of every receipt (see Settings > Store branding).
export const uploadStoreLogo = makeUploader("store");