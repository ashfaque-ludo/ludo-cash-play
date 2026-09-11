const mongoose = require("mongoose");

// Admin-editable warning/notice shown to users on a specific page (withdraw,
// deposit, referral, ...) — Admin Panel → Settings → Page Notices. One
// document per page; saving upserts by `page`, clearing the text hides it.
const PAGES = ["withdraw", "deposit", "referral", "matches", "screenshots", "kyc", "support"];

const schema = new mongoose.Schema({
  page: { type: String, enum: PAGES, required: true, unique: true },
  text: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("PageNotice", schema);
module.exports.PAGES = PAGES;
