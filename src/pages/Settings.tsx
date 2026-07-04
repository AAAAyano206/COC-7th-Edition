/**
 * 设置页
 * Oopz Bot 配置、使用说明
 */

import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function Settings() {
  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const testMutation = trpc.oopz.testMessage.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("测试消息发送成功");
      } else {
        toast.error("测试消息发送失败");
      }
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">设置</h1>
        <p className="text-sm text-zinc-500 mt-1">配置 Oopz Bot 和查看使用说明</p>
      </div>

      {/* Oopz Bot 配置 */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">Oopz Bot 配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">Bot Token</Label>
            <Input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="从 Oopz 开发者平台获取的 Bot Token"
              className="bg-zinc-950 border-zinc-800 text-zinc-100"
            />
            <p className="text-xs text-zinc-500">
              在 Oopz 开发者平台创建 Bot 后获取 Token
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">频道 ID</Label>
            <Input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="要连接的 Oopz 频道 ID"
              className="bg-zinc-950 border-zinc-800 text-zinc-100"
            />
          </div>

          <Button
            onClick={() => {
              if (!botToken || !channelId) {
                toast.error("请填写 Bot Token 和频道 ID");
                return;
              }
              testMutation.mutate({ channelId, botToken });
            }}
            disabled={testMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {testMutation.isPending ? "测试中..." : "发送测试消息"}
          </Button>

          <Separator className="bg-zinc-800" />

          <div className="p-3 bg-zinc-950 rounded text-xs text-zinc-500 space-y-1">
            <p className="font-semibold text-zinc-400">配置步骤:</p>
            <p>1. 在 Oopz 开发者平台 (https://dev.oopz.cn) 创建 Bot</p>
            <p>2. 获取 Bot Token 和频道 ID</p>
            <p>3. 在上方填入并测试连接</p>
            <p>4. 配置 Webhook URL 指向: /api/trpc/oopz.webhook</p>
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">指令说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold text-zinc-300">角色卡管理</h4>
              <div className="space-y-1 text-xs text-zinc-500">
                <p>
                  <span className="text-amber-400">.st</span> 属性名数值 — 录入属性
                </p>
                <p>
                  <span className="text-amber-400">.nn</span> 名称 — 修改角色名
                </p>
                <p>
                  <span className="text-amber-400">.show / .卡</span> — 查看角色卡
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-zinc-300">检定与投掷</h4>
              <div className="space-y-1 text-xs text-zinc-500">
                <p>
                  <span className="text-amber-400">.ra</span> 技能名 [h/e/+1/-1] — 技能检定
                </p>
                <p>
                  <span className="text-amber-400">.sc</span> 成功损失/失败损失 — 理智检定
                </p>
                <p>
                  <span className="text-amber-400">.r</span> 表达式 — 通用骰子
                </p>
                <p>
                  <span className="text-amber-400">.rd</span> 表达式 — 伤害骰
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-zinc-300">属性修改</h4>
              <div className="space-y-1 text-xs text-zinc-500">
                <p>
                  <span className="text-amber-400">.st hp-2</span> — 减少2点HP
                </p>
                <p>
                  <span className="text-amber-400">.st san+1</span> — 增加1点SAN
                </p>
                <p>
                  <span className="text-amber-400">.st mp+3</span> — 增加3点MP
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-zinc-300">检定难度</h4>
              <div className="space-y-1 text-xs text-zinc-500">
                <p>无后缀 = 普通 (目标值)</p>
                <p>
                  <span className="text-amber-400">h</span> = 困难 (目标值/2)
                </p>
                <p>
                  <span className="text-amber-400">e</span> = 极难 (目标值/5)
                </p>
                <p>
                  <span className="text-amber-400">+1/+2</span> = 奖励骰
                </p>
                <p>
                  <span className="text-amber-400">-1/-2</span> = 惩罚骰
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 检定结果说明 */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">检定结果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
            {[
              { label: "大成功", desc: "掷出1", color: "text-yellow-400 bg-yellow-400/10" },
              { label: "极难成功", desc: "≤目标值/5", color: "text-emerald-300 bg-emerald-400/10" },
              { label: "困难成功", desc: "≤目标值/2", color: "text-emerald-400 bg-emerald-400/10" },
              { label: "成功", desc: "≤目标值", color: "text-emerald-500 bg-emerald-400/10" },
              { label: "失败", desc: ">目标值", color: "text-zinc-400 bg-zinc-700/30" },
              { label: "大失败", desc: "100或96-99*", color: "text-red-400 bg-red-400/10" },
            ].map((item) => (
              <div key={item.label} className={`rounded p-2 ${item.color}`}>
                <div className="font-bold">{item.label}</div>
                <div className="text-[10px] opacity-70">{item.desc}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 mt-2">
            * 当目标值小于50时，掷出96-100为大失败；掷出100始终为大失败
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
