/**
 * 检定记录页
 * 显示所有检定历史，支持筛选
 */

import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RESULT_LABELS } from "@contracts/coc";

export default function RollHistory() {
  const { data: rolls, isLoading } = trpc.dice.getHistory.useQuery({ limit: 100 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">检定记录</h1>
        <p className="text-sm text-zinc-500 mt-1">历史投掷与检定记录</p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">全部记录</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rolls && rolls.length > 0 ? (
            <div className="space-y-1">
              {rolls.map((roll) => (
                <div
                  key={roll.id}
                  className="flex items-center justify-between py-2 px-3 rounded hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        roll.result === "critical"
                          ? "border-yellow-600 text-yellow-400"
                          : roll.result === "fumble"
                          ? "border-red-600 text-red-400"
                          : ["success", "hard_success", "extreme_success"].includes(roll.result)
                          ? "border-emerald-600 text-emerald-400"
                          : "border-zinc-700 text-zinc-400"
                      }`}
                    >
                      {RESULT_LABELS[roll.result as keyof typeof RESULT_LABELS] ?? roll.result}
                    </Badge>
                    <span className="text-sm text-zinc-300">{roll.targetName ?? "自定义"}</span>
                    <span className="text-xs text-zinc-500">
                      D100={roll.rollResult}
                      {roll.targetValue ? `/${roll.targetValue}` : ""}
                    </span>
                    {roll.bonusDice !== 0 && (
                      <span className="text-[10px] text-zinc-600">
                        {roll.bonusDice > 0 ? `+${roll.bonusDice}` : roll.bonusDice}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-600 uppercase">
                      {roll.rollType}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {roll.createdAt ? new Date(roll.createdAt).toLocaleString() : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-8">暂无检定记录</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
