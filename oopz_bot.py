#!/usr/bin/env python3
"""
COC 跑团助手 - Oopz Bot 连接脚本

使用方法：
    1. 设置环境变量
    2. pip install oopz-sdk requests
    3. python oopz_bot.py

环境变量：
    OOPZ_DEVICE_ID      - 设备ID
    OOPZ_PERSON_UID     - 用户ID
    OOPZ_JWT_TOKEN      - JWT令牌
    OOPZ_PRIVATE_KEY    - 私钥
    API_BASE_URL        - 后端API地址
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
        # tRPC 使用 { "0": { "json": payload } } 格式
        trpc_payload = {"0": {"json": payload}}
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json=trpc_payload,
            timeout=10,
        )
        if response.status_code == 200:
            result = response.json()
            if "result" in result and "data" in result["result"]:
                return result["result"]["data"]
            return result
        else:
            print(f"[API 错误] HTTP {response.status_code}")
            return {"handled": False}
    except requests.exceptions.ConnectionError:
        print(f"[API 错误] 无法连接: {API_BASE_URL}")
        return {"handled": False}
    except Exception as e:
        print(f"[API 错误] {e}")
        return {"handled": False}


async def handle_message(message, ctx):
    """处理频道消息"""
    text = message.text.strip() if message.text else ""

    # 只处理 . 开头的指令
    if not text.startswith("."):
        return

    channel_id = str(message.channel_id) if message.channel_id else ""
    author_id = str(message.author_id) if message.author_id else ""
    author_name = str(message.author_name) if message.author_name else ""

    print(f"[指令] {author_name}: {text[:40]}")

    # 构建 tRPC 请求（mutation 格式）
    payload = {
        "event": "message.created",
        "data": {
            "id": str(message.message_id) if message.message_id else "",
            "channel_id": channel_id,
            "author": {
                "id": author_id,
                "username": author_name,
            },
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


async def main():
    """主入口"""
    print("=" * 50)
    print("  COC 跑团助手 - Oopz Bot")
    print("=" * 50)

    # 检查凭证
    required = ["OOPZ_DEVICE_ID", "OOPZ_PERSON_UID", "OOPZ_JWT_TOKEN", "OOPZ_PRIVATE_KEY"]
    missing = [e for e in required if not os.environ.get(e)]
    if missing:
        print("\n[错误] 缺少环境变量:")
        for e in missing:
            print(f"  - {e}")
        print("\n获取方法:")
        print("  python -m oopz_sdk.cli.password_login --phone 手机号 --print-env powershell")
        sys.exit(1)

    # 测试后端连接
    print(f"\n[检查] API: {API_BASE_URL}")
    health = call_api("ping", {})
    if health.get("ok"):
        print("[OK] 后端已连接")
    else:
        print("[警告] 后端未响应，Bot 仍会继续")

    # 使用 from_env_async 避免 event loop 冲突
    print("\n[连接] Oopz...")
    try:
        config = await OopzConfig.from_env_async()
    except Exception as e:
        print(f"[错误] 配置加载失败: {e}")
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
