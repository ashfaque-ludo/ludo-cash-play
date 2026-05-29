const rateLimit = require("express-rate-limit");
const opts = { standardHeaders:true, legacyHeaders:false };
module.exports = {
  general:      rateLimit({ ...opts, windowMs:15*60*1000, max:200, message:{ detail:"Too many requests." } }),
  authLimiter:  rateLimit({ ...opts, windowMs:15*60*1000, max:10,  message:{ detail:"Too many login attempts. Wait 15 min." } }),
  adminLimiter: rateLimit({ ...opts, windowMs:60*1000,    max:60,  message:{ detail:"Admin rate limit hit." } }),
};
