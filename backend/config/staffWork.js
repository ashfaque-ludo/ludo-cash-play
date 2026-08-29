// Single source of truth for restricted, phone-login staff accounts (Admin >
// Staff > "Add Restricted Staff"). Each work assignment maps to the one
// /api/admin/* mount that account is allowed to call, and the role needed to
// clear that mount's own requireRole() gate — staffWorkGate (server.js) then
// narrows access down to exactly that mount.
const STAFF_WORK = {
  withdrawals: { label: "Withdrawals", role: "staff_manager", base: "/api/admin/withdrawals" },
  deposits:    { label: "Deposits",    role: "staff_manager", base: "/api/admin/deposits" },
  matches:     { label: "Matches",     role: "support_agent", base: "/api/admin/matches" },
  screenshots: { label: "Screenshots", role: "support_agent", base: "/api/admin/screenshots" },
  kyc:         { label: "KYC",         role: "support_agent", base: "/api/admin/kyc" },
  support:     { label: "Support",     role: "support_agent", base: "/api/admin/support" },
};

module.exports = { STAFF_WORK };
