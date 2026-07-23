"""
AI 回答轻量评价端点

每条 AI 回答末尾显示 👍 有帮助 / 👎 有问题 / 📤 分享 / ✏️ 反馈
用户点击即触发，不点击不产生任何请求和记录。
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Query
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# 存储路径
# ---------------------------------------------------------------------------
FEEDBACK_DIR = Path(__file__).resolve().parents[3] / "data" / "feedback"
EVENTS_FILE = FEEDBACK_DIR / "events.jsonl"


def _ensure_dirs():
    FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_event(record: dict) -> None:
    _ensure_dirs()
    with open(EVENTS_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ActionRequest(BaseModel):
    """轻量评价请求——前端显示 4 个手势按钮，用户点击任一即触发。

    - 仅记录 action 类型和上下文标识
    - 不需要用户填写表单
    - session_id + message_id 用于关联 AI 回答
    """

    session_id: str = ""
    message_id: str = ""  # AI 回答消息的唯一 ID（用于定位是哪条回答）
    action: str  # "thumbs_up" | "thumbs_down" | "share" | "feedback"
    question_text: str = ""  # 用户当时问的问题（可选，用于统计）

    @field_validator("action")
    @classmethod
    def valid_action(cls, v: str) -> str:
        allowed = {"thumbs_up", "thumbs_down", "share", "feedback"}
        if v not in allowed:
            raise ValueError(f"action must be one of {allowed}")
        return v


class ActionResponse(BaseModel):
    ok: bool
    message: str


# ---------------------------------------------------------------------------
# API 端点
# ---------------------------------------------------------------------------


@router.post("/action", response_model=ActionResponse)
async def record_action(body: ActionRequest) -> ActionResponse:
    """
    记录用户对 AI 回答的评价动作。

    四种动作：
    - thumbs_up   👍 有帮助
    - thumbs_down 👎 有问题
    - share       📤 分享
    - feedback    ✏️ 详细反馈（作为标记，后续在聊天中展开反馈表单）

    设计原则：前端始终显示 4 个按钮，用户点击才触发请求，
    不点击不产生任何调用。一次点击 = 一次记录。
    """

    event = {
        "event_id": f"ev_{uuid4().hex[:10]}",
        "session_id": body.session_id,
        "message_id": body.message_id,
        "action": body.action,
        "question_text": body.question_text[:500] if body.question_text else "",
        "timestamp": _utc_now(),
    }

    _append_event(event)

    messages = {
        "thumbs_up": "感谢你的肯定！",
        "thumbs_down": "感谢反馈，我们会努力改进。",
        "share": "",
        "feedback": "",
    }

    return ActionResponse(
        ok=True,
        message=messages.get(body.action, ""),
    )


@router.get("/stats")
async def get_stats(
    action: str = Query("all", description="all | thumbs_up | thumbs_down | share | feedback"),
    limit: int = Query(50),
):
    """管理员用：查看评价统计。"""
    if not EVENTS_FILE.exists():
        return {"total": 0, "by_action": {}, "recent": []}

    events = []
    with open(EVENTS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    # 统计
    counts = {}
    for e in events:
        a = e.get("action", "unknown")
        counts[a] = counts.get(a, 0) + 1

    # 过滤
    if action != "all":
        filtered = [e for e in events if e.get("action") == action]
    else:
        filtered = events

    recent = sorted(filtered, key=lambda e: e.get("timestamp", ""), reverse=True)[:limit]

    return {
        "total": len(events),
        "by_action": counts,
        "recent": recent,
    }
