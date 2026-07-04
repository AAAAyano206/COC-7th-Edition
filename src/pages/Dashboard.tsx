/**
 * 仪表板首页
 * 显示统计数据、快捷操作、最近检定记录
 */

import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RESULT_LABELS } from "@contracts/coc";

export default function Dashboard() {
  const { data: characters, isLoading: charLoading } = trpc.character.list.useQuery({});
  const { data: campaigns, isLoading: campLoading } = trpc.campaign.list.useQuery();
  const { data: recentRolls, isLoading: rollsLoading } = trpc.dice.getHistory.useQuery({ limit: 10 });

  const totalChars = characters?.length ?? 0;
  const totalCamps = campaigns?.length ?? 0;
  const totalRolls = recentRolls?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">仪表板</h1>
        <p className="text-sm text-zinc-500 mt-1">COC 跑团助手 - 总览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-normal">角色卡</CardTitle>
          </CardHeader>
          <CardContent>
            {charLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-amber-400">{totalChars}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-normal">战役</CardTitle>
          </CardHeader>
          <CardContent>
            {campLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-emerald-400">{totalCamps}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-normal">今日检定</CardTitle>
          </CardHeader>
          <CardContent>
            {rollsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-sky-400">{totalRolls}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Link to="/characters/new">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                  新建角色卡
                </Button>
              </Link>
              <Link to="/characters">
                <Button size="sm" variant="outline" className="border-zinc-700">
                  查看角色卡
                </Button>
              </Link>
              <Link to="/campaigns">
                <Button size="sm" variant="outline" className="border-zinc-700">
                  新建战役
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100">Oopz Bot</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400">
              在 Oopz 频道中使用以下指令:
            </p>
            <div className="mt-2 p-3 bg-zinc-950 rounded text-xs text-zinc-500 font-mono space-y-1">
              <p>.st 力量40敏捷70意志45</p>
              <p>.ra 侦查 / .ra 敏捷 h</p>
              <p>.sc 1/1d6 / .r d100</p>
              <p>.nn 角色名 / .show</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 最近检定记录 */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-zinc-100">最近检定记录</CardTitle>
          <Link to="/rolls" className="text-xs text-amber-400 hover:underline">
            查看全部
          </Link>
        </CardHeader>
        <CardContent>
          {rollsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentRolls && recentRolls.length > 0 ? (
            <div className="space-y-1">
              {recentRolls.slice(0, 10).map((roll) => (
                <div
                  key={roll.id}
                  className="flex items-center justify-between py-2 px-3 rounded hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        roll.result === "critical"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : roll.result === "fumble"
                          ? "bg-red-500/20 text-red-400"
                          : ["success", "hard_success", "extreme_success"].includes(roll.result)
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-700 text-zinc-400"
                      }`}
                    >
                      {RESULT_LABELS[roll.result as keyof typeof RESULT_LABELS] ?? roll.result}
                    </span>
                    <span className="text-sm text-zinc-300">
                      {roll.targetName ?? "未知"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      D100={roll.rollResult}/{roll.targetValue ?? "?"}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-600">
                    {roll.createdAt
                      ? new Date(roll.createdAt).toLocaleTimeString()
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-4">暂无检定记录</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
