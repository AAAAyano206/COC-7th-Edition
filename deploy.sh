#!/bin/bash
# ============================================================================
# COC 跑团助手 - 阿里云服务器一键部署脚本
# 
# 使用方法：
#   1. 把项目代码传到服务器 /root/coc-trpg-bot 目录
#   2. chmod +x deploy.sh
#   3. ./deploy.sh
# ============================================================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_DIR="/opt/coc-trpg-bot"
DB_NAME="coc_bot"
DB_USER="coc_user"
DB_PASS="coc_bot_$(openssl rand -hex 4)"  # 自动生成随机密码
APP_PORT=3000

# 辅助函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_banner() {
    echo ""
    echo "============================================================"
    echo "     COC 跑团助手 - 一键部署脚本"
    echo "============================================================"
    echo ""
}

# ============================================================================
# 第1步：检查环境
# ============================================================================
check_env() {
    log_info "检查环境..."
    
    # 检查是否为 root
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本"
        exit 1
    fi
    
    # 检查项目目录
    if [ ! -d "$PROJECT_DIR" ]; then
        log_error "项目目录不存在: $PROJECT_DIR"
        log_info "请先把项目代码传到服务器，例如:"
        log_info "  scp -r ./app root@你的服务器IP:$PROJECT_DIR"
        exit 1
    fi
    
    log_ok "环境检查通过"
}

# ============================================================================
# 第2步：更新系统
# ============================================================================
update_system() {
    log_info "更新系统包..."
    apt update -qq
    apt upgrade -y -qq
    log_ok "系统更新完成"
}

# ============================================================================
# 第3步：安装 Node.js 20
# ============================================================================
install_nodejs() {
    log_info "安装 Node.js 20..."
    
    # 检查是否已安装
    if command -v node &> /dev/null && [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" = "20" ]; then
        log_ok "Node.js $(node -v) 已安装，跳过"
        return
    fi
    
    # 删除旧版本
    apt remove -y nodejs npm 2>/dev/null || true
    
    # 安装 NodeSource 源
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    # 验证
    NODE_V=$(node -v)
    NPM_V=$(npm -v)
    log_ok "Node.js $NODE_V 安装完成"
    log_ok "npm $NPM_V 安装完成"
}

# ============================================================================
# 第4步：安装 MySQL 8.0
# ============================================================================
install_mysql() {
    log_info "安装 MySQL 8.0..."
    
    # 检查是否已安装
    if command -v mysql &> /dev/null; then
        log_ok "MySQL 已安装，跳过"
        return
    fi
    
    apt install -y mysql-server
    
    # 启动并设置开机自启
    systemctl start mysql
    systemctl enable mysql
    
    log_ok "MySQL 安装完成"
}

# ============================================================================
# 第5步：配置数据库
# ============================================================================
setup_database() {
    log_info "配置数据库..."
    
    # 创建数据库
    mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    
    # 创建专用用户
    mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
    mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
    mysql -e "FLUSH PRIVILEGES;"
    
    log_ok "数据库配置完成"
    log_info "数据库名: ${DB_NAME}"
    log_info "数据库用户: ${DB_USER}"
    log_info "数据库密码: ${DB_PASS}"
}

# ============================================================================
# 第6步：安装 PM2
# ============================================================================
install_pm2() {
    log_info "安装 PM2..."
    
    if command -v pm2 &> /dev/null; then
        log_ok "PM2 已安装，跳过"
        return
    fi
    
    npm install -g pm2
    
    # 设置开机自启
    pm2 startup systemd -u root --hp /root 2>/dev/null || true
    
    log_ok "PM2 安装完成"
}

# ============================================================================
# 第7步：安装项目依赖并构建
# ============================================================================
build_project() {
    log_info "安装依赖并构建项目..."
    
    cd "$PROJECT_DIR"
    
    # 安装依赖
    npm install --progress
    
    # 构建
    npm run build
    
    log_ok "项目构建完成"
}

# ============================================================================
# 第8步：配置环境变量
# ============================================================================
setup_env() {
    log_info "配置环境变量..."
    
    cd "$PROJECT_DIR"
    
    # 读取 .env 文件中的 APP_ID 和 APP_SECRET（如果存在）
    APP_ID="19f27c6c-6302-881b-8000-0000ded9c8d8"
    APP_SECRET="HTD6pAozcJTqdtWwfXYefN2egoJdp3Qt"
    
    if [ -f ".env" ]; then
        source .env 2>/dev/null || true
        APP_ID="${APP_ID:-19f27c6c-6302-881b-8000-0000ded9c8d8}"
        APP_SECRET="${APP_SECRET:-HTD6pAozcJTqdtWwfXYefN2egoJdp3Qt}"
    fi
    
    # 生成新的 .env
    cat > "$PROJECT_DIR/.env" << EOF
APP_ID=${APP_ID}
APP_SECRET=${APP_SECRET}
DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}
EOF
    
    log_ok "环境变量配置完成"
    log_info "数据库连接: mysql://${DB_USER}:****@localhost:3306/${DB_NAME}"
}

# ============================================================================
# 第9步：推送数据库 Schema
# ============================================================================
push_schema() {
    log_info "推送数据库 Schema..."
    
    cd "$PROJECT_DIR"
    
    # 设置临时环境变量
    export DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}"
    export APP_ID="${APP_ID}"
    export APP_SECRET="${APP_SECRET}"
    
    npm run db:push
    
    log_ok "数据库 Schema 推送完成"
}

# ============================================================================
# 第10步：用 PM2 启动后端服务
# ============================================================================
start_service() {
    log_info "启动后端服务..."
    
    cd "$PROJECT_DIR"
    
    # 停止旧进程（如果存在）
    pm2 delete coc-api 2>/dev/null || true
    
    # 启动新进程
    pm2 start "$PROJECT_DIR/dist/boot.js" \
        --name "coc-api" \
        --cwd "$PROJECT_DIR" \
        --env "DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}" \
        --env "APP_ID=${APP_ID}" \
        --env "APP_SECRET=${APP_SECRET}" \
        --max-memory-restart 512M \
        --restart-delay 3000
    
    # 保存 PM2 配置
    pm2 save
    
    log_ok "后端服务已启动 (端口 ${APP_PORT})"
}

# ============================================================================
# 第11步：安装并配置 Nginx
# ============================================================================
install_nginx() {
    log_info "安装并配置 Nginx..."
    
    apt install -y nginx
    
    # 创建 Nginx 配置文件
    cat > /etc/nginx/sites-available/coc-bot << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # 前端静态文件（React SPA）
    location / {
        root /opt/coc-trpg-bot/dist/public;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API（tRPC + Hono）
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 支持 WebSocket（如果以后需要）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF
    
    # 启用配置
    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/coc-bot /etc/nginx/sites-enabled/coc-bot
    
    # 测试并重载
    nginx -t && systemctl restart nginx
    systemctl enable nginx
    
    log_ok "Nginx 配置完成"
}

# ============================================================================
# 第12步：配置防火墙
# ============================================================================
setup_firewall() {
    log_info "配置防火墙..."
    
    # 安装 ufw（如果未安装）
    apt install -y ufw 2>/dev/null || true
    
    # 允许 SSH、HTTP、HTTPS
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    
    # 启用防火墙（如果未启用）
    ufw status | grep -q "Status: active" || echo "y" | ufw enable
    
    log_ok "防火墙配置完成"
    log_info "开放的端口: 22(SSH), 80(HTTP), 443(HTTPS)"
}

# ============================================================================
# 第13步：安装 Python3（Bot用）
# ============================================================================
install_python() {
    log_info "安装 Python3..."
    
    apt install -y python3 python3-pip python3-venv
    
    log_ok "Python3 安装完成"
    log_warn "Oopz Bot 需要单独配置凭证后才能启动"
}

# ============================================================================
# 保存部署信息
# ============================================================================
save_info() {
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "你的服务器IP")
    
    cat > "$PROJECT_DIR/.deploy-info" << EOF
============================================================
COC 跑团助手 - 部署信息
============================================================
部署时间: $(date '+%Y-%m-%d %H:%M:%S')
服务器IP: ${SERVER_IP}

访问地址:
  Web 面板: http://${SERVER_IP}
  API 地址: http://${SERVER_IP}/api/trpc

数据库信息:
  数据库名: ${DB_NAME}
  用户名: ${DB_USER}
  密码: ${DB_PASS}
  连接地址: mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}

项目目录: ${PROJECT_DIR}

常用命令:
  查看服务状态: pm2 status
  查看服务日志: pm2 logs coc-api
  重启服务: pm2 restart coc-api
  重启 Nginx: systemctl restart nginx
  重启 Bot: pm2 restart coc-bot

Oopz Bot 启动前需要:
  1. 设置环境变量:
     export OOPZ_DEVICE_ID="你的设备ID"
     export OOPZ_PERSON_UID="你的用户ID"
     export OOPZ_JWT_TOKEN="你的JWT令牌"
     export OOPZ_PRIVATE_KEY="你的私钥"
     export API_BASE_URL="http://localhost:3000/api/trpc"
  
  2. 启动 Bot:
     cd ${PROJECT_DIR}
     python3 oopz_bot.py
     
  3. 或使用 PM2:
     pm2 start "python3 oopz_bot.py" --name coc-bot --cwd ${PROJECT_DIR}
============================================================
EOF
    
    log_ok "部署信息已保存到: $PROJECT_DIR/.deploy-info"
}

# ============================================================================
# 主流程
# ============================================================================
main() {
    print_banner
    
    log_info "开始部署 COC 跑团助手..."
    echo ""
    
    check_env
    update_system
    install_nodejs
    install_mysql
    setup_database
    install_pm2
    build_project
    setup_env
    push_schema
    start_service
    install_nginx
    setup_firewall
    install_python
    save_info
    
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "你的服务器IP")
    
    echo ""
    echo "============================================================"
    echo -e "${GREEN}部署完成！${NC}"
    echo "============================================================"
    echo ""
    echo -e "Web 面板: ${GREEN}http://${SERVER_IP}${NC}"
    echo -e "API 地址: ${GREEN}http://${SERVER_IP}/api/trpc${NC}"
    echo ""
    echo "数据库密码: ${YELLOW}${DB_PASS}${NC}"
    echo "（已保存到 ${PROJECT_DIR}/.deploy-info）"
    echo ""
    echo "下一步："
    echo "  1. 在浏览器访问 http://${SERVER_IP} 测试 Web 面板"
    echo "  2. 配置 Oopz Bot 凭证后启动 Bot"
    echo "  3. 查看 .deploy-info 文件获取完整信息"
    echo ""
}

# 运行
main "$@"
