#!/usr/bin/env python3
"""
COC 跑团助手 - Oopz Bot 连接脚本

使用方法:
    1. 设置环境变量
    2. pip install oopz-sdk requests
    3. python oopz_bot.py
"""

import os
import sys
import asyncio
import requests

# 检查 oopz-sdk
try:
    from oopz_sdk import OopzBot, OopzConfig
except ImportError:
    print("[错误] 未安装 oopz-sdk，请执行: pip install oopz-sdk")
    sys.exit(1)

# 配置
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000/api/trpc")


def call_api(procedure: str, payload: dict) -> dict:
    """调用后端 tRPC API"""
    url = f"{API_BASE_URL}/{procedure}"
    try:
        trpc_payload = {"0": {"json": payload}}
        response = requests.post(url, headers={"Content-Type": "application/json"},
                                 json=trpc_payload, timeout=10)
        if response.status_code == 200:
            result = response.json()
            if "result" in result and "data" in result["result"]:
                return result["result"]["data"]
            return result
        return {"handled": False}
    except Exception:
        return {"handled": False}


async def handle_message(message, ctx):
    """处理频道消息"""
    text = message.text.strip() if message.text else ""
    if not text.startswith("."):
        return

    channel_id = str(message.channel_id) if message.channel_id else ""
    author_id = str(message.author_id) if message.author_id else ""
    author_name = str(message.author_name) if message.author_name else ""

    print(f"[指令] {author_name}: {text[:40]}")

    payload = {
        "event": "message.created",
        "data": {
            "id": str(message.message_id) if message.message_id else "",
            "channel_id": channel_id,
            "author": {"id": author_id, "username": author_name},
            "content": text,
            "timestamp": str(message.created_at) if message.created_at else "",
        },
    }

    result = call_api("oopz.webhook", payload)

    if result.get("handled") and result.get("reply"):
        try:
            await ctx.reply(result["reply"])
        except Exception as e:
            print(f"[发送失败] {e}")


def read_private_key() -> str:
    """读取 PRIVATE_KEY，支持多行格式"""
    key = os.environ.get("OOPZ_PRIVATE_KEY", "")
    if not key:
        return ""
    # 处理 \n 转义字符
    key = key.replace("\\n", "\n")
    # 确保有正确的头部和尾部
    key = key.strip()
    if not key.startswith("-----"):
        # 可能 PEM 格式被破坏了，尝试修复
        pass
    return key


async def main():
    print("=" * 50)
    print("  COC 跑团助手 - Oopz Bot")
    print("=" * 50)

    # 读取凭证 - 直接从环境变量获取
    device_id = os.environ.get("OOPZ_DEVICE_ID", "")
    person_uid = os.environ.get("OOPZ_PERSON_UID", "")
    jwt_token = os.environ.get("OOPZ_JWT_TOKEN", "")
    private_key = read_private_key()

    # 检查凭证完整性
    missing = []
    if not device_id:
        missing.append("OOPZ_DEVICE_ID")
    if not person_uid:
        missing.append("OOPZ_PERSON_UID")
    if not jwt_token:
        missing.append("OOPZ_JWT_TOKEN")
    if not private_key:
        missing.append("OOPZ_PRIVATE_KEY")

    if missing:
        print(f"\n[错误] 缺少环境变量: {', '.join(missing)}")
        print("\n当前环境变量值:")
        for key in ["OOPZ_DEVICE_ID", "OOPZ_PERSON_UID", "OOPZ_JWT_TOKEN", "OOPZ_PRIVATE_KEY"]:
            val = os.environ.get(key, "(未设置)")
            if val and len(val) > 20:
                val = val[:20] + "..."
            print(f"  {key}={val}")
        print("\n请确保已执行 export 命令设置凭证")
        sys.exit(1)

    # 测试后端连接
    print(f"\n[检查] API: {API_BASE_URL}")
    health = call_api("ping", {})
    if health.get("ok"):
        print("[OK] 后端已连接")
    else:
        print("[警告] 后端未响应，Bot 仍会继续")

    # 创建 OopzConfig 对象 - 直接传入凭证
    print("\n[连接] Oopz...")
    try:
        config = OopzConfig(
            device_id=device_id,
            person_uid=person_uid,
            jwt_token=jwt_token,
            private_key=private_key,
        )
    except Exception as e:
        print(f"[错误] 创建配置失败: {e}")
        sys.exit(1)

    bot = OopzBot(config)

    @bot.on_ready
    async def on_ready(ctx):
        print("=" * 50)
        print("  Bot 已连接! 指令前缀: .")
        print("  .help 查看帮助")
        print("=" * 50)

    @bot.on_message
    async def on_message(message, ctx):
        await handle_message(message, ctx)

    await bot.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[退出] Bot 已停止")
    except Exception as e:
        print(f"\n[致命错误] {e}")
        import traceback
        traceback.print_exc()
