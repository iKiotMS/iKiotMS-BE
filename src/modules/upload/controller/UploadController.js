const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../../../public/uploads"));
  },
  filename: (req, file, cb) => {
    // Generate a unique filename: timestamp + random hash + original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed."), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

class UploadController {
  // Expose the multer single file middleware
  get uploadMiddleware() {
    return upload.single("file");
  }

  async upload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file provided or invalid file type",
        });
      }

      // Generate the URL path for the client
      const fileUrl = `/uploads/${req.file.filename}`;

      res.status(200).json({
        success: true,
        message: "File uploaded successfully",
        data: {
          url: fileUrl,
        },
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to upload file",
      });
    }
  }
}

module.exports = new UploadController();
