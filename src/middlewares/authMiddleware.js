const jwt = require("jsonwebtoken");

const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!token) {
    return res.status(401).json({ message: "Missing access token." });
  }

  if (!secret) {
    return res.status(500).json({ message: "JWT secret is not configured." });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (_error) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};

module.exports = { verifyJwt };
