const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const Screenshot = require("../models/Screenshot");
const Match = require("../models/Match");

const dir = path.join(__dirname, "../uploads/screenshots");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${req.user._id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

router.get("/api/upload", (req, res) => {
  res.json({ message: "Screenshot upload route is live. Use POST /api/upload to upload." });
});

router.post("/api/upload", auth, upload.single("screenshot"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { match_id } = req.body;
    if (!match_id || !mongoose.Types.ObjectId.isValid(match_id)) {
      return res.status(400).json({ error: "A valid match_id is required." });
    }

    const match = await Match.findById(match_id);
    if (!match) return res.status(404).json({ error: "Match not found." });

    const isParticipant = match.players.some(
      (p) => p.user && p.user.toString() === req.user._id.toString()
    );
    if (!isParticipant) return res.status(403).json({ error: "You are not a player in this match." });

    // Prize amount is never taken from the client — it's derived from the
    // match's own stake/commission/prize_pool, set server-side at match creation.
    const prizeAmount = match.stake * 2;
    const commission = match.commission;
    const net_prize = match.prize_pool;

    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    const fileUrl = `${backendUrl}/uploads/screenshots/${req.file.filename}`;

    const screenshot = await Screenshot.create({
      user: req.user._id,
      match_id,
      filename: req.file.filename,
      url: fileUrl,
      amount: prizeAmount,
      commission,
      net_prize,
      status: "pending",
    });

    res.json({
      message: "Screenshot uploaded successfully. Pending admin review.",
      screenshot_id: screenshot._id,
      filename: req.file.filename,
      url: fileUrl,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

module.exports = router;
