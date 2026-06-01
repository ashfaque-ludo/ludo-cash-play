const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
  image_url: { type: String, default: "" },
  link: { type: String, default: "/play" },
  bg_from: { type: String, default: "#581c87" },
  bg_to: { type: String, default: "#1e3a8a" },
  active: { type: Boolean, default: true },
  position: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Banner", schema);
