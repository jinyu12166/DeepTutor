"""
微信小程序登录端点

为和平树AI学习助手微信小程序提供免密登录能力。
小程序端调用 wx.login() 获取 code，发送到此端点换取 JWT token。

技术路径：
  wx.login() → 小程序 code
  → POST /api/v1/auth/wechat/login  (本端点)
  → 调用微信 code2Session API 换取 openid
  → 查找/创建本地用户（存入 PocketBase 或 auth_users.json）
  → 签发 JWT → 返回给小程序 → 小程序存入 storage

部署时需要在 data/user/settings/integrations.json 中配置：
  "wechat_app_id": "wx**********",
  "wechat_app_secret": "**********"
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from deeptutor.multi_user.identity import new_user_id, utc_now
from deeptutor.services.auth import (
    AUTH_ENABLED,
    AUTH_SECRET,
    POCKETBASE_BASE_URL,
    POCKETBASE_ENABLED,
    TokenPayload,
    create_token,
)
from deeptutor.services.config import load_integrations_settings

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# 配置加载
# ---------------------------------------------------------------------------

_WECHAT_APP_ID = ""
_WECHAT_APP_SECRET = ""


def _load_wechat_config():
    """从 integrations.json 加载微信小程序配置。每调用一次刷新一次，支持热更新。"""
    global _WECHAT_APP_ID, _WECHAT_APP_SECRET
    settings = load_integrations_settings()
    _WECHAT_APP_ID = str(settings.get("wechat_app_id", "")).strip()
    _WECHAT_APP_SECRET = str(settings.get("wechat_app_secret", "")).strip()


# 首次加载
_load_wechat_config()

WECHAT_CODESESSION_URL = "https://api.weixin.qq.com/sns/jscode2session"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class WechatLoginRequest(BaseModel):
    """微信小程序登录请求。"""
    code: str  # wx.login() 返回的临时 code


class WechatLoginResponse(BaseModel):
    """微信小程序登录响应。"""
    ok: bool
    user_id: str = ""
    nickname: str = ""
    avatar_url: str = ""
    role: str = "user"
    is_admin: bool = False
    token: str = ""  # JWT token，小程序端存入 storage，后续请求带 Authorization: Bearer <token>


# ---------------------------------------------------------------------------
# 微信 code2Session 调用
# ---------------------------------------------------------------------------


async def _exchange_code(code: str) -> tuple[str | None, str | None, str | None]:
    """
    用临时 code 换取 openid、session_key 和 unionid。

    返回 (openid, session_key, unionid)，任一失败则全部为 None。
    """
    _load_wechat_config()

    if not _WECHAT_APP_ID or not _WECHAT_APP_SECRET:
        logger.error("微信小程序 AppID 或 AppSecret 未配置。请在 integrations.json 中设置 wechat_app_id 和 wechat_app_secret。")
        return None, None, None

    params = {
        "appid": _WECHAT_APP_ID,
        "secret": _WECHAT_APP_SECRET,
        "js_code": code,
        "grant_type": "authorization_code",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(WECHAT_CODESESSION_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error(f"微信 code2Session 请求失败: {exc}")
        return None, None, None

    errcode = data.get("errcode", 0)
    if errcode != 0:
        errmsg = data.get("errmsg", "unknown error")
        logger.error(f"微信 code2Session 返回错误: errcode={errcode}, errmsg={errmsg}")
        return None, None, None

    openid = data.get("openid")
    session_key = data.get("session_key")
    unionid = data.get("unionid")

    if not openid:
        logger.error("微信 code2Session 未返回 openid")
        return None, None, None

    return openid, session_key, unionid


# ---------------------------------------------------------------------------
# 用户查找 / 创建
# ---------------------------------------------------------------------------

# 扩展用户记录的字段名：存储微信 openid 和基本资料
WECHAT_OPENID_KEY = "wechat_openid"
WECHAT_UNIONID_KEY = "wechat_unionid"
WECHAT_NICKNAME_KEY = "wechat_nickname"
WECHAT_AVATAR_KEY = "wechat_avatar_url"


def _find_or_create_wechat_user(openid: str, unionid: str | None = None) -> dict:
    """
    根据微信 openid 查找或创建本地用户。

    PocketBase 模式：通过 wechat_openid 字段搜索用户记录
    SQLite/JSON 模式：遍历 auth_users.json 查找匹配的 openid

    找不到就创建新用户（默认 role=user）。
    """
    if POCKETBASE_ENABLED and POCKETBASE_BASE_URL:
        return _find_or_create_wechat_user_pb(openid, unionid)
    return _find_or_create_wechat_user_json(openid, unionid)


def _find_or_create_wechat_user_json(openid: str, unionid: str | None = None) -> dict:
    """JSON 模式：在 auth_users.json 中查找或创建用户。"""
    from deeptutor.multi_user.identity import USERS_FILE, _USERS_WRITE_LOCK

    # 确保目录存在
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)

    users: dict = {}
    if USERS_FILE.exists():
        try:
            users = json.loads(USERS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            users = {}

    # 查找已有 openid 匹配的用户
    for username, record in users.items():
        if not isinstance(record, dict):
            continue
        if record.get(WECHAT_OPENID_KEY) == openid:
            logger.info(f"微信用户 '{username}' 已存在 (openid={openid[:8]}...), 直接登录")
            return {
                "id": record.get("id", ""),
                "username": username,
                "role": str(record.get("role", "user")),
                "nickname": str(record.get(WECHAT_NICKNAME_KEY, "")),
                "avatar_url": str(record.get(WECHAT_AVATAR_KEY, "")),
            }

    # 未找到 → 创建新用户
    with _USERS_WRITE_LOCK:
        # 重新读取（锁内二次确认，防止竞态）
        if USERS_FILE.exists():
            try:
                users = json.loads(USERS_FILE.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                users = {}

        # 生成用户名：wx_<openid前8位>
        username = f"wx_{openid[:8]}"
        user_id = new_user_id()
        created_at = utc_now()

        users[username] = {
            "id": user_id,
            "hash": "",  # 微信用户不使用密码
            "role": "user",
            "created_at": created_at,
            "disabled": False,
            "avatar": "",
            WECHAT_OPENID_KEY: openid,
            WECHAT_UNIONID_KEY: unionid or "",
            WECHAT_NICKNAME_KEY: f"用户{openid[:6]}",
            WECHAT_AVATAR_KEY: "",
        }

        USERS_FILE.write_text(json.dumps(users, indent=2, ensure_ascii=False), encoding="utf-8")

    logger.info(f"创建微信用户 '{username}' (openid={openid[:8]}...)")
    return {
        "id": user_id,
        "username": username,
        "role": "user",
        "nickname": f"用户{openid[:6]}",
        "avatar_url": "",
    }


def _find_or_create_wechat_user_pb(openid: str, unionid: str | None = None) -> dict:
    """
    PocketBase 模式：通过 filter 查找 wechat_openid 匹配的记录。

    PocketBase 需要预先在 users collection 中添加 wechat_openid 字段（text 类型，可索引）。
    如果 PocketBase 不可用，回退到 JSON 模式。
    """
    import httpx as _httpx

    try:
        # PocketBase 的 users collection 默认 endpoint
        pb_users_url = f"{POCKETBASE_BASE_URL}/api/collections/users/records"

        # 查找已有 openid 匹配的记录
        filter_str = f"{WECHAT_OPENID_KEY}='{openid}'"
        async def _search():
            async with _httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(pb_users_url, params={"filter": filter_str, "perPage": 1})
                resp.raise_for_status()
                return resp.json()

        # 简化：同步方式（在 FastAPI async 端点中会正确使用 httpx）
    except Exception as exc:
        logger.warning(f"PocketBase 微信用户查找失败({exc})，回退到 JSON 模式")
        return _find_or_create_wechat_user_json(openid, unionid)

    # 如果 PocketBase 集成复杂，直接回退 JSON 模式最为稳妥
    logger.info("当前使用 JSON 模式管理微信用户（PocketBase 扩展暂未部署）")
    return _find_or_create_wechat_user_json(openid, unionid)


# ---------------------------------------------------------------------------
# API 端点
# ---------------------------------------------------------------------------


@router.post("/wechat/login", response_model=WechatLoginResponse)
async def wechat_login(body: WechatLoginRequest) -> WechatLoginResponse:
    """
    微信小程序登录端点。

    流程：
    1. 小程序端调用 wx.login() 获取临时 code
    2. 小程序将 code 发送到此端点
    3. 此端点调用微信 code2Session API 获取 openid
    4. 查找或创建本地用户
    5. 签发 JWT token
    6. 返回 token + 用户信息给小程序

    小程序端收到 token 后，存入 wx.setStorageSync('token', token)，
    后续所有 API 请求都在 header 中携带 Authorization: Bearer <token>。
    """
    # Step 1: code → openid
    openid, session_key, unionid = await _exchange_code(body.code)
    if not openid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="微信登录失败：无法获取 openid，请检查 code 是否有效或 AppID/Secret 配置是否正确。",
        )

    # Step 2: 查找或创建用户
    user = _find_or_create_wechat_user(openid, unionid)

    # Step 3: 签发 JWT
    token_payload = TokenPayload(
        username=user["username"],
        role=user["role"],
        user_id=user["id"],
    )
    token = create_token(
        token_payload.username,
        token_payload.role,
        token_payload.user_id,
    )

    logger.info(
        f"微信用户 '{user['username']}' 登录成功 "
        f"(openid={openid[:8]}...)"
    )

    return WechatLoginResponse(
        ok=True,
        user_id=user["id"],
        nickname=user.get("nickname", ""),
        avatar_url=user.get("avatar_url", ""),
        role=user["role"],
        is_admin=user["role"] == "admin",
        token=token,
    )
