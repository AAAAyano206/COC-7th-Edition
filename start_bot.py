#!/usr/bin/env python3
"""
COC 跑团助手 - Bot 启动器（简化版）

此脚本会引导你完成：
1. 检查环境
2. 获取 Oopz 凭证（如未配置）
3. 启动 Bot

使用方法：
    python start_bot.py
"""

import os
import sys
import subprocess
import json


def check_python_version():
    """检查 Python 版本"""
    if sys.version_info < (3, 10):
        print("[错误] 需要 Python 3.10 或更高版本")
        print(f"当前版本: {sys.version_info.major}.{sys.version_info.minor}")
        sys.exit(1)
    print(f"[OK] Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")


def install_dependencies():
    """安装依赖"""
    print("\n[步骤 1/4] 检查依赖...")
    
    # 检查 oopz-sdk
    try:
        import oopz_sdk
        print("  [OK] oopz-sdk 已安装")
    except ImportError:
        print("  [安装] oopz-sdk...")
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "oopz-sdk", "-q"],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"  [错误] 安装失败: {result.stderr}")
            sys.exit(1)
        print("  [OK] oopz-sdk 安装完成")
    
    # 检查 requests
    try:
        import requests
        print("  [OK] requests 已安装")
    except ImportError:
        print("  [安装] requests...")
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "requests", "-q"],
            capture_output=True
        )
        print("  [OK] requests 安装完成")
    
    # 检查 playwright
    try:
        import playwright
        print("  [OK] playwright 已安装")
    except ImportError:
        print("  [安装] playwright...")
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "playwright", "-q"],
            capture_output=True
        )
        subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            capture_output=True
        )
        print("  [OK] playwright 安装完成")


def check_credentials():
    """检查 Oopz 凭证"""
    print("\n[步骤 2/4] 检查 Oopz 凭证...")
    
    required = ["OOPZ_DEVICE_ID", "OOPZ_PERSON_UID", "OOPZ_JWT_TOKEN", "OOPZ_PRIVATE_KEY"]
    missing = [e for e in required if not os.environ.get(e)]
    
    if not missing:
        print("  [OK] 所有凭证已配置")
        return True
    
    print(f"  [提示] 缺少 {len(missing)} 个环境变量")
    print("\n  你需要登录 Oopz 获取凭证。")
    print("  请输入 Bot 账号的手机号:")
    
    phone = input("  > ").strip()
    if not phone:
        print("  [取消] 未输入手机号")
        return False
    
    print(f"\n  正在登录 {phone}...")
    print("  （如果需要验证码，会弹出浏览器窗口）\n")
    
    try:
        result = subprocess.run(
            [
                sys.executable, "-m", "oopz_sdk.cli.password_login",
                "--phone", phone,
                "--print-env", "json"
            ],
            capture_output=True, text=True, timeout=120
        )
        
        # 尝试解析 JSON 输出
        output = result.stdout.strip()
        # 找到 JSON 部分
        json_start = output.find('{')
        json_end = output.rfind('}') + 1
        
        if json_start >= 0 and json_end > json_start:
            creds = json.loads(output[json_start:json_end])
            
            print("\n  [成功] 凭证获取成功!\n")
            print("  请执行以下命令设置环境变量:\n")
            
            if sys.platform == "win32":
                print(f"    $env:OOPZ_DEVICE_ID=\"{creds.get('OOPZ_DEVICE_ID', '')}\"")
                print(f"    $env:OOPZ_PERSON_UID=\"{creds.get('OOPZ_PERSON_UID', '')}\"")
                print(f"    $env:OOPZ_JWT_TOKEN=\"{creds.get('OOPZ_JWT_TOKEN', '')}\"")
                print(f"    $env:OOPZ_PRIVATE_KEY=\"{creds.get('OOPZ_PRIVATE_KEY', '')}\"")
            else:
                print(f"    export OOPZ_DEVICE_ID=\"{creds.get('OOPZ_DEVICE_ID', '')}\"")
                print(f"    export OOPZ_PERSON_UID=\"{creds.get('OOPZ_PERSON_UID', '')}\"")
                print(f"    export OOPZ_JWT_TOKEN=\"{creds.get('OOPZ_JWT_TOKEN', '')}\"")
                print(f"    export OOPZ_PRIVATE_KEY=\"{creds.get('OOPZ_PRIVATE_KEY', '')}\"")
            
            print("\n  设置完成后，重新运行此脚本。")
            return False
        else:
            print(f"  [错误] 无法解析凭证输出")
            print(f"  输出: {output[:200]}")
            return False
            
    except subprocess.TimeoutExpired:
        print("  [错误] 登录超时")
        return False
    except Exception as e:
        print(f"  [错误] {e}")
        return False


def check_backend():
    """检查后段 API"""
    print("\n[步骤 3/4] 检查后端 API...")
    
    import requests
    api_url = os.environ.get("API_BASE_URL", "http://localhost:3000/api/trpc")
    
    try:
        response = requests.post(
            f"{api_url}/ping",
            json={},
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("result", {}).get("data", {}).get("ok"):
                print(f"  [OK] 后端 API 正常运行")
                return True
    except:
        pass
    
    print(f"  [警告] 后端 API 未响应: {api_url}")
    print("  请在另一个终端运行: npm run dev")
    print("  或者设置正确的 API_BASE_URL 环境变量")
    return False


def start_bot():
    """启动 Bot"""
    print("\n[步骤 4/4] 启动 Bot...\n")
    
    # 直接导入并运行 oopz_bot.py
    import importlib.util
    spec = importlib.util.spec_from_file_location("oopz_bot", "oopz_bot.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    
    import asyncio
    asyncio.run(module.main())


def main():
    """主流程"""
    print("=" * 60)
    print("  COC 跑团助手 - Bot 启动器")
    print("=" * 60)
    
    check_python_version()
    install_dependencies()
    
    if not check_credentials():
        print("\n[退出] 请先配置凭证后重新运行")
        sys.exit(1)
    
    check_backend()
    start_bot()


if __name__ == "__main__":
    main()
