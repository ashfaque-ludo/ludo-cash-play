import React from "react";

const RED_AVATAR = "/battle/red_user.png";
const BLUE_AVATAR = "/battle/blue_user.png";
const VS_BADGE = "/battle/vs.png";

// blue_user.png isn't a plain circular avatar (it's a wide two-character
// banner) — zoom + position the background so the crop lands on the blue
// character's face instead of the "VS" text in the middle of that image.
const ROLE_STYLE = {
  red:  { backgroundImage: `url(${RED_AVATAR})`, backgroundSize: "cover", backgroundPosition: "center" },
  blue: { backgroundImage: `url(${BLUE_AVATAR})`, backgroundSize: "420% 420%", backgroundPosition: "8% 22%" },
};

// Simple string hash so the red/blue side assignment is deterministic per
// battle (stable across re-renders/polls of the same battle) but varies
// from one battle to the next instead of always putting the same color on
// the same side.
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Returns [roleForPlayer1, roleForPlayer2], e.g. ["red","blue"] or ["blue","red"].
export function battleRoles(battleId) {
  return hashStr(String(battleId || "")) % 2 === 0 ? ["red", "blue"] : ["blue", "red"];
}

// Renders the player's real profile photo if they've set one, otherwise the
// red/blue placeholder for their assigned role.
export function PlayerAvatar({ player, role, size = "w-11 h-11" }) {
  if (player?.avatar) {
    return (
      <img
        src={player.avatar}
        alt={player?.name || "Player"}
        className={`${size} rounded-full object-cover shrink-0 ring-2 ring-white/10 bg-black/20`}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full shrink-0 ring-2 ring-white/10 bg-black/20`}
      style={ROLE_STYLE[role] || ROLE_STYLE.red}
      role="img"
      aria-label={player?.name || "Player"}
    />
  );
}

// The vs.png badge with the battle amount shown directly underneath it.
export function VsBadge({ amount, size = "w-10 h-10" }) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <img src={VS_BADGE} alt="VS" className={`${size} rounded-full object-cover shadow-md`} />
      {amount != null && <span className="text-xs font-black text-emerald-400">{amount}</span>}
    </div>
  );
}
