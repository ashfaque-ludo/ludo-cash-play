const { body, param, validationResult } = require("express-validator");

const validators = {
  phone: body("phone")
    .notEmpty().withMessage("Phone is required")
    .customSanitizer(v => String(v).replace(/\D/g, "").replace(/^91/, "").slice(-10))
    .matches(/^[6-9]\d{9}$/).withMessage("Invalid Indian phone number"),

  otp: body("otp")
    .isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits")
    .isNumeric().withMessage("OTP must be numeric"),

  amount: body("amount")
    .isFloat({ min: 10, max: 1000000 }).withMessage("Amount must be 10–10,00,000"),

  withdrawAmount: body("amount")
    .isFloat({ min: 100, max: 1000000 }).withMessage("Minimum withdrawal 100"),

  upiId: body("upi_id")
    .optional()
    .matches(/^[a-zA-Z0-9.\-_]+@[a-zA-Z]+$/).withMessage("Invalid UPI ID"),

  name: body("name")
    .optional()
    .isLength({ min: 2, max: 50 }).withMessage("Name must be 2–50 characters")
    .matches(/^[a-zA-Z0-9 ]+$/).withMessage("Name contains invalid characters"),

  mongoId: param("id").isMongoId().withMessage("Invalid ID format"),
};

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ detail: errors.array()[0].msg, errors: errors.array() });
  }
  next();
};

// XSS sanitizer applied globally before routes
const sanitizeInput = (req, res, next) => {
  const clean = (v) => {
    if (typeof v !== "string") return v;
    return v.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<[^>]+>/g, "").trim();
  };
  const walk = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "string") return clean(obj);
    if (Array.isArray(obj)) return obj.map(walk);
    if (typeof obj === "object") {
      const out = {};
      for (const k in obj) out[k] = walk(obj[k]);
      return out;
    }
    return obj;
  };
  if (req.body && typeof req.body === "object") req.body = walk(req.body);
  if (req.query && typeof req.query === "object") req.query = walk(req.query);
  next();
};

module.exports = { validators, handleValidation, sanitizeInput };
