#!/bin/bash
cd /opt/coc-trpg-bot
source venv/bin/activate
export API_BASE_URL="http://139.224.247.100:3000/api/trpc"
python oopz_bot.py