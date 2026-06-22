const UploadController = require("./controller/UploadController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

/**
 * @openapi
 * /uploads:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Upload an image file
 *     description: Upload a single image file to the server. Returns the file URL.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The image file to upload
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: File uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       example: /uploads/1623456789012-image.jpg
 *       400:
 *         description: Validation error or missing file
 *       401:
 *         description: Unauthorized
 */
const registerUploadModule = (app) => {
  app.post("/uploads", verifyJwt, UploadController.uploadMiddleware, UploadController.upload.bind(UploadController));
  console.log("✓ Upload module registered");
};

module.exports = { registerUploadModule };
