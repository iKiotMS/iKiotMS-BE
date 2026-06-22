const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
require("dotenv").config();

// Configure Cloudinary using credentials from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer to use Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "ikiot_uploads", // Tên thư mục trên Cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "webp", "gif"],
    // transformation: [{ width: 1000, height: 1000, crop: "limit" }], // Tùy chọn resize ảnh tự động nếu cần
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Giới hạn 5MB
  },
});

class UploadController {
  // Expose middleware upload 1 file của multer
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

      // Multer-storage-cloudinary tự động upload và trả về URL an toàn trong req.file.path
      const fileUrl = req.file.path;

      res.status(200).json({
        success: true,
        message: "File uploaded to Cloudinary successfully",
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
