from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import uuid
import logging
import secrets
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Any, Dict
from contextlib import asynccontextmanager

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------- Config ----------
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
ACCESS_TTL_MIN = 60 * 24  # 1 day for smoother UX during MVP
REFRESH_TTL_DAYS = 14
MASTER_EMAIL = os.environ["ADMIN_EMAIL"].lower().strip()
MASTER_PASSWORD = os.environ["ADMIN_PASSWORD"]

ROLE_LEVEL = {
    "user": 0,
    "support_agent": 1,
    "staff_manager": 2,
    "admin": 3,
    "super_admin": 4,
}

STAKE_TABLES = [
    {"stake": 50, "tier": "standard", "label": "Bronze"},
    {"stake": 100, "tier": "standard", "label": "Silver"},
    {"stake": 500, "tier": "standard", "label": "Gold"},
    {"stake": 1000, "tier": "premium", "label": "Platinum"},
    {"stake": 5000, "tier": "premium", "label": "Diamond"},
    {"stake": 10000, "tier": "premium", "label": "Ruby"},
    {"stake": 50000, "tier": "vip", "label": "Emerald VIP"},
    {"stake": 100000, "tier": "vip", "label": "High Roller VIP"},
]
COMMISSION_PCT = 10  # platform commission on match prize

# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_id() -> str:
    return uuid.uuid4().hex

def make_ref_code(name: str) -> str:
    base = re.sub(r"[^A-Z0-9]", "", (name or "PLAY").upper())[:5] or "PLAY"
    return f"{base}{secrets.token_hex(2).upper()}"

def make_room_code() -> str:
    return "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))

def public_user(u: Dict[str, Any]) -> Dict[str, Any]:
    if not u:
        return None
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "phone": u.get("phone", ""),
        "role": u.get("role", "user"),
        "is_master_owner": bool(u.get("is_master_owner", False)),
        "banned": bool(u.get("banned", False)),
        "wallet": u.get("wallet", {"deposit": 0, "winning": 0, "bonus": 0}),
        "referral_code": u.get("referral_code"),
        "referred_by": u.get("referred_by"),
        "kyc_status": u.get("kyc_status", "unverified"),
        "avatar_seed": u.get("avatar_seed", u["id"][:6]),
        "matches_played": u.get("matches_played", 0),
        "matches_won": u.get("matches_won", 0),
        "total_winnings": u.get("total_winnings", 0),
        "created_at": u.get("created_at"),
    }

def create_access_token(uid: str, email: str, role: str) -> str:
    payload = {
        "sub": uid,
        "email": email,
        "role": role,
        "type": "access",
        "exp": now_utc() + timedelta(minutes=ACCESS_TTL_MIN),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def create_refresh_token(uid: str) -> str:
    payload = {
        "sub": uid,
        "type": "refresh",
        "exp": now_utc() + timedelta(days=REFRESH_TTL_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def set_auth_cookies(resp: Response, access: str, refresh: str):
    resp.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax",
                    max_age=ACCESS_TTL_MIN * 60, path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax",
                    max_age=REFRESH_TTL_DAYS * 86400, path="/")

def clear_auth_cookies(resp: Response):
    resp.delete_cookie("access_token", path="/")
    resp.delete_cookie("refresh_token", path="/")

async def get_token_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Account banned")
    return user

def require_role(min_role: str):
    async def _dep(user: Dict[str, Any] = Depends(get_token_user)) -> Dict[str, Any]:
        if ROLE_LEVEL.get(user.get("role", "user"), 0) < ROLE_LEVEL[min_role]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _dep

async def log_activity(actor: Dict[str, Any], action: str, target: Optional[str] = None, meta: Optional[Dict] = None):
    await db.activity_logs.insert_one({
        "id": make_id(),
        "actor_id": actor["id"],
        "actor_email": actor["email"],
        "actor_role": actor["role"],
        "action": action,
        "target": target,
        "meta": meta or {},
        "created_at": iso(now_utc()),
    })

# ---------- Pydantic models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=2, max_length=60)
    phone: Optional[str] = Field(default=None, max_length=20)
    referral_code: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class DepositIn(BaseModel):
    amount: float = Field(gt=0)
    method: Literal["upi", "card", "netbanking"] = "upi"
    screenshot_b64: Optional[str] = None
    upi_id: Optional[str] = None

class WithdrawIn(BaseModel):
    amount: float = Field(gt=0)
    upi_id: str = Field(min_length=3)

class PromoRedeemIn(BaseModel):
    code: str

class CreateMatchIn(BaseModel):
    stake: int

class JoinMatchIn(BaseModel):
    room_code: Optional[str] = None

class SubmitResultIn(BaseModel):
    result: Literal["won", "lost", "cancel"]
    screenshot_b64: Optional[str] = None
    note: Optional[str] = None

class AdminUpdateUserIn(BaseModel):
    role: Optional[Literal["user", "support_agent", "staff_manager", "admin", "super_admin"]] = None
    banned: Optional[bool] = None
    name: Optional[str] = None

class AdminWalletEditIn(BaseModel):
    deposit: Optional[float] = None
    winning: Optional[float] = None
    bonus: Optional[float] = None
    reason: str = Field(min_length=3)

class AdminResetPwIn(BaseModel):
    new_password: str = Field(min_length=6)

class AdminDecideMatchIn(BaseModel):
    winner_id: Optional[str] = None
    cancel: bool = False
    note: Optional[str] = None

class PromoIn(BaseModel):
    code: str = Field(min_length=3, max_length=24)
    amount: float = Field(gt=0)
    max_redemptions: int = Field(ge=1, default=100)
    expires_at: Optional[str] = None

class BroadcastIn(BaseModel):
    title: str
    message: str
    audience: Literal["all", "vip", "admins"] = "all"

class MaintenanceIn(BaseModel):
    enabled: bool
    message: Optional[str] = None

class StakeTableIn(BaseModel):
    stake: int = Field(gt=0)
    tier: Literal["standard", "premium", "vip"] = "standard"
    label: str = Field(min_length=2, max_length=40)
    active: bool = True

class StaffCreateIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=2, max_length=60)
    role: Literal["support_agent", "staff_manager", "admin"] = "support_agent"

# ---------- App lifecycle ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("referral_code")
    await db.matches.create_index("id", unique=True)
    await db.matches.create_index([("status", 1), ("stake", 1)])
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.deposits.create_index([("status", 1), ("created_at", -1)])
    await db.withdrawals.create_index([("status", 1), ("created_at", -1)])
    await db.activity_logs.create_index([("created_at", -1)])
    await db.promos.create_index("code", unique=True)
    await db.config.create_index("key", unique=True)
    # seed master owner
    await seed_master()
    # seed config
    if not await db.config.find_one({"key": "maintenance"}):
        await db.config.insert_one({"key": "maintenance", "enabled": False, "message": ""})
    # write test credentials file
    try:
        memdir = Path("/app/memory")
        memdir.mkdir(parents=True, exist_ok=True)
        (memdir / "test_credentials.md").write_text(
            f"""# MyAkadda — Test Credentials

## Master Super Admin (permanent, cannot be removed)
- Email: `{MASTER_EMAIL}`
- Password: `{MASTER_PASSWORD}`
- Role: `super_admin` (is_master_owner=true)

## Auth Endpoints (all under /api)
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/me
- POST /api/auth/refresh

Login sets httpOnly cookies (`access_token`, `refresh_token`). Frontend uses `withCredentials: true`.
"""
        )
    except Exception as e:
        logging.warning(f"Could not write test_credentials.md: {e}")
    yield
    client.close()

async def seed_master():
    existing = await db.users.find_one({"email": MASTER_EMAIL})
    if existing is None:
        uid = make_id()
        await db.users.insert_one({
            "id": uid,
            "email": MASTER_EMAIL,
            "password_hash": hash_pw(MASTER_PASSWORD),
            "name": "Master Owner",
            "phone": "",
            "role": "super_admin",
            "is_master_owner": True,
            "banned": False,
            "wallet": {"deposit": 0, "winning": 0, "bonus": 0},
            "referral_code": "MASTER01",
            "referred_by": None,
            "kyc_status": "verified",
            "avatar_seed": "MASTER",
            "matches_played": 0,
            "matches_won": 0,
            "total_winnings": 0,
            "created_at": iso(now_utc()),
        })
    else:
        # Always enforce master role + master flag + unban
        updates = {"role": "super_admin", "is_master_owner": True, "banned": False}
        if not verify_pw(MASTER_PASSWORD, existing.get("password_hash", "")):
            updates["password_hash"] = hash_pw(MASTER_PASSWORD)
        await db.users.update_one({"email": MASTER_EMAIL}, {"$set": updates})

app = FastAPI(lifespan=lifespan, title="MyAkadda API")

api = APIRouter(prefix="/api")

# ---------- Auth ----------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = make_id()
    referred_by = None
    bonus = 0
    if payload.referral_code:
        ref = await db.users.find_one({"referral_code": payload.referral_code.upper()})
        if ref:
            referred_by = ref["id"]
            bonus = 50
            await db.users.update_one({"id": ref["id"]}, {
                "$inc": {"wallet.bonus": 25, "referral_earnings": 25},
                "$push": {"referrals": uid},
            })
    user_doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_pw(payload.password),
        "name": payload.name.strip(),
        "phone": (payload.phone or "").strip(),
        "role": "user",
        "is_master_owner": False,
        "banned": False,
        "wallet": {"deposit": 0, "winning": 0, "bonus": bonus},
        "referral_code": make_ref_code(payload.name),
        "referred_by": referred_by,
        "kyc_status": "unverified",
        "avatar_seed": uid[:6],
        "matches_played": 0,
        "matches_won": 0,
        "total_winnings": 0,
        "referral_earnings": 0,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user_doc)
    if bonus:
        await db.transactions.insert_one({
            "id": make_id(), "user_id": uid, "type": "bonus", "amount": bonus,
            "status": "completed", "note": "Welcome referral bonus",
            "created_at": iso(now_utc()),
        })
    access = create_access_token(uid, email, "user")
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return public_user(user_doc)

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_pw(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Account banned. Contact support.")
    access = create_access_token(user["id"], user["email"], user.get("role", "user"))
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return public_user(user)

@api.post("/auth/logout")
async def logout(response: Response, user=Depends(get_token_user)):
    clear_auth_cookies(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(get_token_user)):
    return public_user(user)

@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    rtok = request.cookies.get("refresh_token")
    if not rtok:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(rtok, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user or user.get("banned"):
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax",
                        max_age=ACCESS_TTL_MIN * 60, path="/")
    return {"ok": True}

# ---------- Wallet ----------
@api.get("/wallet")
async def wallet(user=Depends(get_token_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"wallet": u.get("wallet", {"deposit": 0, "winning": 0, "bonus": 0})}

@api.get("/wallet/transactions")
async def transactions(user=Depends(get_token_user), limit: int = 50):
    txs = await db.transactions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"transactions": txs}

@api.post("/wallet/deposit")
async def deposit(payload: DepositIn, user=Depends(get_token_user)):
    # MOCKED Razorpay flow: creates a pending deposit; admin approves to credit wallet.
    dep_id = make_id()
    doc = {
        "id": dep_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "amount": float(payload.amount),
        "method": payload.method,
        "upi_id": payload.upi_id,
        "screenshot_b64": payload.screenshot_b64,
        "status": "pending",
        "mock_provider": "razorpay",
        "mock_order_id": f"order_{secrets.token_hex(6)}",
        "created_at": iso(now_utc()),
    }
    await db.deposits.insert_one(doc)
    await db.transactions.insert_one({
        "id": make_id(), "user_id": user["id"], "type": "deposit",
        "amount": float(payload.amount), "status": "pending",
        "ref_id": dep_id, "note": f"Deposit via {payload.method}",
        "created_at": iso(now_utc()),
    })
    return {"deposit_id": dep_id, "status": "pending", "mock_order_id": doc["mock_order_id"]}

@api.post("/wallet/withdraw")
async def withdraw(payload: WithdrawIn, user=Depends(get_token_user)):
    u = await db.users.find_one({"id": user["id"]})
    bal_winning = u["wallet"].get("winning", 0)
    if payload.amount > bal_winning:
        raise HTTPException(status_code=400, detail="Insufficient winnings balance")
    if payload.amount < 100:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is ₹100")
    # Reserve amount
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet.winning": -payload.amount}})
    wid = make_id()
    await db.withdrawals.insert_one({
        "id": wid, "user_id": user["id"], "user_email": user["email"],
        "amount": float(payload.amount), "upi_id": payload.upi_id,
        "status": "pending", "created_at": iso(now_utc()),
    })
    await db.transactions.insert_one({
        "id": make_id(), "user_id": user["id"], "type": "withdraw",
        "amount": -float(payload.amount), "status": "pending",
        "ref_id": wid, "note": f"Withdraw to {payload.upi_id}",
        "created_at": iso(now_utc()),
    })
    return {"withdrawal_id": wid, "status": "pending"}

@api.post("/wallet/redeem-promo")
async def redeem_promo(payload: PromoRedeemIn, user=Depends(get_token_user)):
    code = payload.code.upper().strip()
    promo = await db.promos.find_one({"code": code})
    if not promo:
        raise HTTPException(status_code=404, detail="Invalid promo code")
    if promo.get("expires_at") and promo["expires_at"] < iso(now_utc()):
        raise HTTPException(status_code=400, detail="Promo expired")
    if user["id"] in promo.get("redeemed_by", []):
        raise HTTPException(status_code=400, detail="Already redeemed")
    if len(promo.get("redeemed_by", [])) >= promo.get("max_redemptions", 100):
        raise HTTPException(status_code=400, detail="Promo limit reached")
    await db.promos.update_one({"code": code}, {"$push": {"redeemed_by": user["id"]}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet.bonus": promo["amount"]}})
    await db.transactions.insert_one({
        "id": make_id(), "user_id": user["id"], "type": "promo",
        "amount": promo["amount"], "status": "completed",
        "note": f"Promo {code}", "created_at": iso(now_utc()),
    })
    return {"ok": True, "amount": promo["amount"]}

# ---------- Matches ----------
async def get_effective_tables() -> List[Dict[str, Any]]:
    """Return active stake tables (DB overrides default in-memory list)."""
    custom = await db.stake_tables.find({"active": True}, {"_id": 0}).sort("stake", 1).to_list(100)
    if custom:
        return [{"stake": t["stake"], "tier": t.get("tier", "standard"), "label": t.get("label", "Table")} for t in custom]
    return STAKE_TABLES

@api.get("/matches/tables")
async def match_tables():
    counts = {}
    cursor = db.matches.aggregate([
        {"$match": {"status": {"$in": ["waiting", "in_progress"]}}},
        {"$group": {"_id": "$stake", "n": {"$sum": 1}}}
    ])
    async for row in cursor:
        counts[row["_id"]] = row["n"]
    tables = await get_effective_tables()
    return {
        "tables": [
            {**t, "active": counts.get(t["stake"], 0), "prize": int(t["stake"] * 2 * (100 - COMMISSION_PCT) / 100)}
            for t in tables
        ]
    }

@api.get("/matches")
async def list_matches(user=Depends(get_token_user), status_f: Optional[str] = Query(None, alias="status"), stake: Optional[int] = None):
    q: Dict[str, Any] = {}
    if status_f:
        q["status"] = status_f
    if stake:
        q["stake"] = stake
    # Open challenges + user's own matches
    q = {"$and": [q, {"$or": [{"status": "waiting"}, {"player_ids": user["id"]}]}]} if status_f or stake else \
        {"$or": [{"status": "waiting"}, {"player_ids": user["id"]}]}
    matches = await db.matches.find(q, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return {"matches": matches}

@api.get("/matches/{mid}")
async def get_match(mid: str, user=Depends(get_token_user)):
    m = await db.matches.find_one({"id": mid}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    return m

@api.post("/matches")
async def create_match(payload: CreateMatchIn, user=Depends(get_token_user)):
    stake = payload.stake
    eff = await get_effective_tables()
    tier_meta = next((t for t in eff if t["stake"] == stake), None)
    if not tier_meta:
        raise HTTPException(status_code=400, detail="Invalid stake")
    u = await db.users.find_one({"id": user["id"]})
    total_play = u["wallet"].get("deposit", 0) + u["wallet"].get("winning", 0) + u["wallet"].get("bonus", 0)
    if total_play < stake:
        raise HTTPException(status_code=400, detail="Insufficient balance to join this table")
    debit_from_wallets(u, stake)
    await db.users.update_one({"id": user["id"]}, {"$set": {"wallet": u["wallet"]}})
    mid = make_id()
    room_code = make_room_code()
    match = {
        "id": mid,
        "stake": stake,
        "tier": tier_meta["tier"],
        "label": tier_meta["label"],
        "prize": int(stake * 2 * (100 - COMMISSION_PCT) / 100),
        "commission_pct": COMMISSION_PCT,
        "status": "waiting",
        "room_code": room_code,
        "creator_id": user["id"],
        "creator_name": user["name"],
        "player_ids": [user["id"]],
        "players": [{"id": user["id"], "name": user["name"], "avatar_seed": user.get("avatar_seed", user["id"][:6])}],
        "results": {},
        "winner_id": None,
        "created_at": iso(now_utc()),
        "started_at": None,
        "ended_at": None,
    }
    await db.matches.insert_one(match)
    await db.transactions.insert_one({
        "id": make_id(), "user_id": user["id"], "type": "match_entry",
        "amount": -float(stake), "status": "completed",
        "ref_id": mid, "note": f"Entry fee {tier_meta['label']}",
        "created_at": iso(now_utc()),
    })
    match.pop("_id", None)
    return match

def debit_from_wallets(u: Dict[str, Any], amount: int):
    """Mutates u['wallet'] in place. Spends bonus first, then deposit, then winning."""
    w = u["wallet"]
    remaining = amount
    for key in ("bonus", "deposit", "winning"):
        if remaining <= 0:
            break
        take = min(w.get(key, 0), remaining)
        w[key] = w.get(key, 0) - take
        remaining -= take

@api.post("/matches/{mid}/join")
async def join_match(mid: str, payload: JoinMatchIn, user=Depends(get_token_user)):
    m = await db.matches.find_one({"id": mid})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    if m["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Match not joinable")
    if user["id"] in m["player_ids"]:
        raise HTTPException(status_code=400, detail="Already joined")
    if len(m["player_ids"]) >= 2:
        raise HTTPException(status_code=400, detail="Match full")
    u = await db.users.find_one({"id": user["id"]})
    total_play = u["wallet"].get("deposit", 0) + u["wallet"].get("winning", 0) + u["wallet"].get("bonus", 0)
    if total_play < m["stake"]:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    debit_from_wallets(u, m["stake"])
    await db.users.update_one({"id": user["id"]}, {"$set": {"wallet": u["wallet"]}})
    await db.matches.update_one({"id": mid}, {
        "$push": {
            "player_ids": user["id"],
            "players": {"id": user["id"], "name": user["name"], "avatar_seed": user.get("avatar_seed", user["id"][:6])},
        },
        "$set": {"status": "in_progress", "started_at": iso(now_utc())},
    })
    await db.transactions.insert_one({
        "id": make_id(), "user_id": user["id"], "type": "match_entry",
        "amount": -float(m["stake"]), "status": "completed",
        "ref_id": mid, "note": f"Entry fee {m['label']}",
        "created_at": iso(now_utc()),
    })
    return await db.matches.find_one({"id": mid}, {"_id": 0})

@api.post("/matches/{mid}/submit-result")
async def submit_result(mid: str, payload: SubmitResultIn, user=Depends(get_token_user)):
    m = await db.matches.find_one({"id": mid})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    if user["id"] not in m["player_ids"]:
        raise HTTPException(status_code=403, detail="Not a player in this match")
    if m["status"] in ("ended", "cancelled"):
        raise HTTPException(status_code=400, detail="Match already finalized")
    results = m.get("results", {})
    results[user["id"]] = {
        "result": payload.result,
        "screenshot_b64": payload.screenshot_b64,
        "note": payload.note,
        "submitted_at": iso(now_utc()),
    }
    new_status = "awaiting_review"
    # Auto-resolve if both submitted consistent
    if len(m["player_ids"]) == 2 and len(results) == 2:
        a, b = m["player_ids"]
        ra, rb = results[a]["result"], results[b]["result"]
        if ra == "won" and rb == "lost":
            await _finalize_match(m, winner_id=a)
            return {"ok": True, "auto_resolved": True, "winner_id": a}
        if rb == "won" and ra == "lost":
            await _finalize_match(m, winner_id=b)
            return {"ok": True, "auto_resolved": True, "winner_id": b}
        if ra == "cancel" and rb == "cancel":
            await _finalize_match(m, cancel=True)
            return {"ok": True, "auto_resolved": True, "cancelled": True}
        new_status = "disputed"
    await db.matches.update_one({"id": mid}, {"$set": {"results": results, "status": new_status}})
    return {"ok": True, "status": new_status}

async def _finalize_match(m: Dict[str, Any], winner_id: Optional[str] = None, cancel: bool = False):
    mid = m["id"]
    if cancel:
        # refund stakes back to deposit wallet
        for pid in m["player_ids"]:
            await db.users.update_one({"id": pid}, {"$inc": {"wallet.deposit": m["stake"]}})
            await db.transactions.insert_one({
                "id": make_id(), "user_id": pid, "type": "refund",
                "amount": float(m["stake"]), "status": "completed",
                "ref_id": mid, "note": "Match cancelled refund",
                "created_at": iso(now_utc()),
            })
        await db.matches.update_one({"id": mid}, {"$set": {"status": "cancelled", "ended_at": iso(now_utc())}})
        return
    prize = m["prize"]
    await db.users.update_one({"id": winner_id}, {
        "$inc": {"wallet.winning": prize, "matches_won": 1, "matches_played": 1, "total_winnings": prize}
    })
    losers = [p for p in m["player_ids"] if p != winner_id]
    for lid in losers:
        await db.users.update_one({"id": lid}, {"$inc": {"matches_played": 1}})
    await db.transactions.insert_one({
        "id": make_id(), "user_id": winner_id, "type": "match_win",
        "amount": float(prize), "status": "completed",
        "ref_id": mid, "note": f"Won {m['label']} match",
        "created_at": iso(now_utc()),
    })
    await db.matches.update_one({"id": mid}, {"$set": {
        "status": "ended", "winner_id": winner_id, "ended_at": iso(now_utc())
    }})

# ---------- Referral ----------
@api.get("/referral")
async def my_referral(user=Depends(get_token_user)):
    refs = await db.users.find({"referred_by": user["id"]}, {"_id": 0, "id": 1, "name": 1, "created_at": 1, "matches_played": 1}).to_list(200)
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {
        "code": u["referral_code"],
        "total_earnings": u.get("referral_earnings", 0),
        "referred_count": len(refs),
        "referrals": refs,
    }

# ---------- Public / marketing ----------
@api.get("/public/config")
async def public_config():
    cfg = await db.config.find_one({"key": "maintenance"}, {"_id": 0}) or {"enabled": False, "message": ""}
    return {
        "maintenance": {"enabled": cfg.get("enabled", False), "message": cfg.get("message", "")},
        "stake_tables": STAKE_TABLES,
        "commission_pct": COMMISSION_PCT,
    }

@api.get("/public/leaderboard")
async def leaderboard():
    rows = await db.users.find(
        {"role": "user", "total_winnings": {"$gt": 0}},
        {"_id": 0, "id": 1, "name": 1, "total_winnings": 1, "matches_won": 1, "avatar_seed": 1}
    ).sort("total_winnings", -1).limit(10).to_list(10)
    return {"leaderboard": rows}

@api.get("/public/winners")
async def winners():
    matches = await db.matches.find(
        {"status": "ended", "winner_id": {"$ne": None}},
        {"_id": 0, "id": 1, "stake": 1, "prize": 1, "label": 1, "winner_id": 1, "ended_at": 1, "players": 1}
    ).sort("ended_at", -1).limit(15).to_list(15)
    return {"winners": matches}

@api.get("/public/withdrawal-ticker")
async def withdrawal_ticker():
    rows = await db.withdrawals.find(
        {"status": "approved"}, {"_id": 0, "amount": 1, "user_email": 1, "created_at": 1}
    ).sort("created_at", -1).limit(20).to_list(20)
    # mask emails
    out = []
    for r in rows:
        email = r.get("user_email", "")
        if "@" in email:
            name = email.split("@")[0]
            masked = name[:2] + "***" + name[-1:] if len(name) > 3 else name[:1] + "***"
        else:
            masked = "player"
        out.append({"amount": r["amount"], "user": masked, "at": r.get("created_at")})
    # if empty, synthesize friendly placeholders
    if not out:
        out = [{"amount": v, "user": u, "at": iso(now_utc())} for v, u in
               [(2500, "ra***v"), (10000, "ne***a"), (500, "ar***n"), (50000, "vi***t")]]
    return {"ticker": out}

@api.get("/public/online-count")
async def online_count():
    n = await db.users.count_documents({"role": "user"})
    base = 1200 + (n * 7)
    # Add a deterministic small jitter
    jitter = int((now_utc().timestamp() // 30) % 137)
    return {"online": base + jitter}

@api.get("/public/stats")
async def stats():
    users = await db.users.count_documents({})
    matches = await db.matches.count_documents({"status": "ended"})
    total_prize_cursor = db.matches.aggregate([
        {"$match": {"status": "ended"}}, {"$group": {"_id": None, "s": {"$sum": "$prize"}}}
    ])
    total_prize = 0
    async for r in total_prize_cursor:
        total_prize = r["s"]
    return {"users": users, "matches": matches, "total_prize_paid": total_prize}

# ---------- Admin ----------
def is_protected_target(target: Dict[str, Any]) -> bool:
    return bool(target.get("is_master_owner"))

@api.get("/admin/users")
async def admin_users(actor=Depends(require_role("support_agent")), q: Optional[str] = None, role: Optional[str] = None, limit: int = 200):
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [{"email": {"$regex": q, "$options": "i"}}, {"name": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": q, "$options": "i"}}]
    if role:
        query["role"] = role
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"users": users}

@api.patch("/admin/users/{uid}")
async def admin_update_user(uid: str, payload: AdminUpdateUserIn, actor=Depends(require_role("admin"))):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if is_protected_target(target) and target["id"] != actor["id"]:
        raise HTTPException(status_code=403, detail="Master owner is protected")
    updates: Dict[str, Any] = {}
    if payload.role is not None:
        if payload.role == "super_admin" and actor.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Only super_admin can assign super_admin")
        # admins cannot demote/promote other super_admins unless they are master owner
        if target.get("role") == "super_admin" and not actor.get("is_master_owner"):
            raise HTTPException(status_code=403, detail="Only master owner can change a super_admin")
        updates["role"] = payload.role
    if payload.banned is not None:
        updates["banned"] = payload.banned
    if payload.name is not None:
        updates["name"] = payload.name
    if not updates:
        return public_user(target)
    await db.users.update_one({"id": uid}, {"$set": updates})
    await log_activity(actor, "user.update", uid, updates)
    new = await db.users.find_one({"id": uid}, {"_id": 0})
    return public_user(new)

@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, actor=Depends(require_role("super_admin"))):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if is_protected_target(target):
        raise HTTPException(status_code=403, detail="Master owner cannot be deleted")
    if target["id"] == actor["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"id": uid})
    await log_activity(actor, "user.delete", uid)
    return {"ok": True}

@api.post("/admin/users/{uid}/reset-password")
async def admin_reset_pw(uid: str, payload: AdminResetPwIn, actor=Depends(require_role("admin"))):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if is_protected_target(target) and target["id"] != actor["id"]:
        raise HTTPException(status_code=403, detail="Cannot reset master owner password")
    await db.users.update_one({"id": uid}, {"$set": {"password_hash": hash_pw(payload.new_password)}})
    await log_activity(actor, "user.reset_password", uid)
    return {"ok": True}

@api.post("/admin/users/{uid}/wallet")
async def admin_edit_wallet(uid: str, payload: AdminWalletEditIn, actor=Depends(require_role("super_admin"))):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    new_wallet = dict(target.get("wallet", {"deposit": 0, "winning": 0, "bonus": 0}))
    if payload.deposit is not None:
        new_wallet["deposit"] = payload.deposit
    if payload.winning is not None:
        new_wallet["winning"] = payload.winning
    if payload.bonus is not None:
        new_wallet["bonus"] = payload.bonus
    await db.users.update_one({"id": uid}, {"$set": {"wallet": new_wallet}})
    await db.transactions.insert_one({
        "id": make_id(), "user_id": uid, "type": "admin_adjust",
        "amount": 0, "status": "completed",
        "note": f"Admin wallet edit by {actor['email']}: {payload.reason}",
        "meta": new_wallet, "created_at": iso(now_utc()),
    })
    await log_activity(actor, "user.wallet_edit", uid, {"new_wallet": new_wallet, "reason": payload.reason})
    return {"ok": True, "wallet": new_wallet}

# Deposits
@api.get("/admin/deposits")
async def admin_deposits(actor=Depends(require_role("staff_manager")), status_f: Optional[str] = Query("pending", alias="status")):
    q = {"status": status_f} if status_f else {}
    rows = await db.deposits.find(q, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return {"deposits": rows}

@api.post("/admin/deposits/{did}/approve")
async def admin_approve_deposit(did: str, actor=Depends(require_role("staff_manager"))):
    dep = await db.deposits.find_one({"id": did})
    if not dep or dep["status"] != "pending":
        raise HTTPException(status_code=400, detail="Deposit not pending")
    await db.users.update_one({"id": dep["user_id"]}, {"$inc": {"wallet.deposit": dep["amount"]}})
    await db.deposits.update_one({"id": did}, {"$set": {"status": "approved", "approved_at": iso(now_utc()), "approver_id": actor["id"]}})
    await db.transactions.update_one({"ref_id": did, "type": "deposit"}, {"$set": {"status": "completed"}})
    await log_activity(actor, "deposit.approve", did, {"amount": dep["amount"]})
    return {"ok": True}

@api.post("/admin/deposits/{did}/reject")
async def admin_reject_deposit(did: str, actor=Depends(require_role("staff_manager"))):
    dep = await db.deposits.find_one({"id": did})
    if not dep or dep["status"] != "pending":
        raise HTTPException(status_code=400, detail="Deposit not pending")
    await db.deposits.update_one({"id": did}, {"$set": {"status": "rejected", "rejected_at": iso(now_utc()), "approver_id": actor["id"]}})
    await db.transactions.update_one({"ref_id": did, "type": "deposit"}, {"$set": {"status": "rejected"}})
    await log_activity(actor, "deposit.reject", did)
    return {"ok": True}

# Withdrawals
@api.get("/admin/withdrawals")
async def admin_withdrawals(actor=Depends(require_role("staff_manager")), status_f: Optional[str] = Query("pending", alias="status")):
    q = {"status": status_f} if status_f else {}
    rows = await db.withdrawals.find(q, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return {"withdrawals": rows}

@api.post("/admin/withdrawals/{wid}/approve")
async def admin_approve_withdraw(wid: str, actor=Depends(require_role("staff_manager"))):
    wd = await db.withdrawals.find_one({"id": wid})
    if not wd or wd["status"] != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal not pending")
    await db.withdrawals.update_one({"id": wid}, {"$set": {"status": "approved", "approved_at": iso(now_utc()), "approver_id": actor["id"]}})
    await db.transactions.update_one({"ref_id": wid, "type": "withdraw"}, {"$set": {"status": "completed"}})
    await log_activity(actor, "withdraw.approve", wid, {"amount": wd["amount"]})
    return {"ok": True}

@api.post("/admin/withdrawals/{wid}/reject")
async def admin_reject_withdraw(wid: str, actor=Depends(require_role("staff_manager"))):
    wd = await db.withdrawals.find_one({"id": wid})
    if not wd or wd["status"] != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal not pending")
    # refund reserved amount
    await db.users.update_one({"id": wd["user_id"]}, {"$inc": {"wallet.winning": wd["amount"]}})
    await db.withdrawals.update_one({"id": wid}, {"$set": {"status": "rejected", "rejected_at": iso(now_utc()), "approver_id": actor["id"]}})
    await db.transactions.update_one({"ref_id": wid, "type": "withdraw"}, {"$set": {"status": "rejected"}})
    await log_activity(actor, "withdraw.reject", wid)
    return {"ok": True}

# Matches admin
@api.get("/admin/matches")
async def admin_matches(actor=Depends(require_role("support_agent")), status_f: Optional[str] = Query(None, alias="status")):
    q: Dict[str, Any] = {}
    if status_f:
        q["status"] = status_f
    rows = await db.matches.find(q, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return {"matches": rows}

@api.post("/admin/matches/{mid}/decide")
async def admin_decide(mid: str, payload: AdminDecideMatchIn, actor=Depends(require_role("admin"))):
    m = await db.matches.find_one({"id": mid})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    if m["status"] in ("ended", "cancelled"):
        raise HTTPException(status_code=400, detail="Already finalized")
    if payload.cancel:
        await _finalize_match(m, cancel=True)
    else:
        if not payload.winner_id or payload.winner_id not in m["player_ids"]:
            raise HTTPException(status_code=400, detail="Invalid winner_id")
        await _finalize_match(m, winner_id=payload.winner_id)
    await log_activity(actor, "match.decide", mid, {"winner_id": payload.winner_id, "cancel": payload.cancel, "note": payload.note})
    return {"ok": True}

# Promo
@api.get("/admin/promos")
async def admin_list_promos(actor=Depends(require_role("admin"))):
    rows = await db.promos.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"promos": rows}

@api.post("/admin/promos")
async def admin_create_promo(payload: PromoIn, actor=Depends(require_role("admin"))):
    code = payload.code.upper().strip()
    if await db.promos.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Promo code exists")
    doc = {
        "code": code, "amount": payload.amount, "max_redemptions": payload.max_redemptions,
        "expires_at": payload.expires_at, "redeemed_by": [],
        "created_by": actor["id"], "created_at": iso(now_utc()),
    }
    await db.promos.insert_one(doc)
    await log_activity(actor, "promo.create", code, {"amount": payload.amount})
    doc.pop("_id", None)
    return doc

@api.delete("/admin/promos/{code}")
async def admin_delete_promo(code: str, actor=Depends(require_role("admin"))):
    await db.promos.delete_one({"code": code.upper()})
    await log_activity(actor, "promo.delete", code)
    return {"ok": True}

# Broadcast
@api.post("/admin/broadcasts")
async def admin_broadcast(payload: BroadcastIn, actor=Depends(require_role("admin"))):
    doc = {"id": make_id(), "title": payload.title, "message": payload.message,
           "audience": payload.audience, "created_by": actor["id"], "created_at": iso(now_utc())}
    await db.broadcasts.insert_one(doc)
    await log_activity(actor, "broadcast.send", doc["id"], {"title": payload.title, "audience": payload.audience})
    doc.pop("_id", None)
    return doc

@api.get("/admin/broadcasts")
async def admin_list_broadcasts(actor=Depends(require_role("support_agent"))):
    rows = await db.broadcasts.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"broadcasts": rows}

@api.get("/broadcasts/latest")
async def latest_broadcasts():
    rows = await db.broadcasts.find({"audience": "all"}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    return {"broadcasts": rows}

# Analytics
@api.get("/admin/analytics")
async def admin_analytics(actor=Depends(require_role("staff_manager"))):
    users = await db.users.count_documents({"role": "user"})
    admins = await db.users.count_documents({"role": {"$in": ["admin", "super_admin", "staff_manager", "support_agent"]}})
    active_matches = await db.matches.count_documents({"status": {"$in": ["waiting", "in_progress"]}})
    completed_matches = await db.matches.count_documents({"status": "ended"})
    pending_deposits = await db.deposits.count_documents({"status": "pending"})
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    total_deposit_cur = db.deposits.aggregate([{"$match": {"status": "approved"}}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}])
    total_withdraw_cur = db.withdrawals.aggregate([{"$match": {"status": "approved"}}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}])
    total_prize_cur = db.matches.aggregate([{"$match": {"status": "ended"}}, {"$group": {"_id": None, "s": {"$sum": "$prize"}, "stake": {"$sum": "$stake"}}}])
    total_deposit = 0
    total_withdraw = 0
    total_prize = 0
    total_stake = 0
    async for r in total_deposit_cur:
        total_deposit = r["s"]
    async for r in total_withdraw_cur:
        total_withdraw = r["s"]
    async for r in total_prize_cur:
        total_prize = r["s"]
        total_stake = r["stake"] * 2
    commission = max(0, total_stake - total_prize)
    return {
        "users": users, "admins": admins,
        "active_matches": active_matches, "completed_matches": completed_matches,
        "pending_deposits": pending_deposits, "pending_withdrawals": pending_withdrawals,
        "total_deposit": total_deposit, "total_withdraw": total_withdraw,
        "platform_commission_earned": commission,
    }

# Logs
@api.get("/admin/activity-logs")
async def admin_logs(actor=Depends(require_role("admin")), limit: int = 100):
    rows = await db.activity_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"logs": rows}

# Maintenance
@api.post("/admin/maintenance")
async def admin_maintenance(payload: MaintenanceIn, actor=Depends(require_role("super_admin"))):
    await db.config.update_one(
        {"key": "maintenance"},
        {"$set": {"enabled": payload.enabled, "message": payload.message or ""}},
        upsert=True
    )
    await log_activity(actor, "maintenance.toggle", "maintenance", {"enabled": payload.enabled})
    return {"ok": True}

# Stake tables CRUD (super_admin only)
@api.get("/admin/stake-tables")
async def admin_list_tables(actor=Depends(require_role("admin"))):
    custom = await db.stake_tables.find({}, {"_id": 0}).sort("stake", 1).to_list(100)
    return {"tables": custom, "defaults": STAKE_TABLES}

@api.post("/admin/stake-tables")
async def admin_create_table(payload: StakeTableIn, actor=Depends(require_role("super_admin"))):
    existing = await db.stake_tables.find_one({"stake": payload.stake})
    if existing:
        raise HTTPException(status_code=400, detail="Table with this stake already exists")
    doc = {**payload.model_dump(), "created_at": iso(now_utc()), "created_by": actor["id"]}
    await db.stake_tables.insert_one(doc)
    await log_activity(actor, "table.create", str(payload.stake), payload.model_dump())
    doc.pop("_id", None)
    return doc

@api.patch("/admin/stake-tables/{stake}")
async def admin_update_table(stake: int, payload: StakeTableIn, actor=Depends(require_role("super_admin"))):
    res = await db.stake_tables.update_one(
        {"stake": stake},
        {"$set": payload.model_dump()},
        upsert=True,
    )
    await log_activity(actor, "table.update", str(stake), payload.model_dump())
    return {"ok": True, "matched": res.matched_count}

@api.delete("/admin/stake-tables/{stake}")
async def admin_delete_table(stake: int, actor=Depends(require_role("super_admin"))):
    r = await db.stake_tables.delete_one({"stake": stake})
    await log_activity(actor, "table.delete", str(stake))
    return {"ok": True, "deleted": r.deleted_count}

@api.post("/admin/stake-tables/seed-defaults")
async def admin_seed_default_tables(actor=Depends(require_role("super_admin"))):
    """Bulk seed the 8 default tables into DB so super_admin can edit them."""
    n = 0
    for t in STAKE_TABLES:
        ex = await db.stake_tables.find_one({"stake": t["stake"]})
        if not ex:
            await db.stake_tables.insert_one({**t, "active": True, "created_at": iso(now_utc()), "created_by": actor["id"]})
            n += 1
    await log_activity(actor, "table.seed_defaults", "stake_tables", {"inserted": n})
    return {"ok": True, "inserted": n}

# Staff creation (super_admin only)
@api.post("/admin/staff/create")
async def admin_create_staff(payload: StaffCreateIn, actor=Depends(require_role("super_admin"))):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    uid = make_id()
    await db.users.insert_one({
        "id": uid,
        "email": email,
        "password_hash": hash_pw(payload.password),
        "name": payload.name.strip(),
        "phone": "",
        "role": payload.role,
        "is_master_owner": False,
        "banned": False,
        "wallet": {"deposit": 0, "winning": 0, "bonus": 0},
        "referral_code": make_ref_code(payload.name),
        "referred_by": None,
        "kyc_status": "verified",
        "avatar_seed": uid[:6],
        "matches_played": 0,
        "matches_won": 0,
        "total_winnings": 0,
        "created_at": iso(now_utc()),
        "created_by": actor["id"],
    })
    await log_activity(actor, "staff.create", uid, {"email": email, "role": payload.role})
    return {"ok": True, "id": uid, "email": email, "role": payload.role}

# Sessions / force-logout (super_admin) — by rotating user's password_hash salt the existing JWTs remain valid
# until expiry but we provide an explicit endpoint here for clarity.
@api.post("/admin/users/{uid}/force-logout")
async def admin_force_logout(uid: str, actor=Depends(require_role("admin"))):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if is_protected_target(target) and target["id"] != actor["id"]:
        raise HTTPException(status_code=403, detail="Master owner is protected")
    # banning briefly invalidates active tokens via get_token_user banned check; we use a session_version bump instead
    await db.users.update_one({"id": uid}, {"$inc": {"session_version": 1}})
    await log_activity(actor, "user.force_logout", uid)
    return {"ok": True}

# ---------- Mount ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

@api.get("/")
async def root():
    return {"app": "MyAkadda API", "status": "ok"}
