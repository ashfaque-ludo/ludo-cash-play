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
  // base:"*" is special-cased in server.js's staffWorkGate to skip the
  // single-mount restriction — this account reaches every /api/admin/* mount.
  // It still can never delete anything: masterOwnerOnlyDelete (server.js)
  // blocks every DELETE request for accounts that aren't the master owner,
  // regardless of role, so this grants full read/manage access without ever
  // opening up destructive actions.
  admin:       { label: "Admin (All Access)", role: "super_admin", base: "*" },
};

module.exports = { STAFF_WORK };
