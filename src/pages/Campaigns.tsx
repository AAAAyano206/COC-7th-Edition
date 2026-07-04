/**
 * 战役管理页
 */

import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Campaigns() {
  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.campaign.list.useQuery();
  const { data: players } = trpc.player.list.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", gmId: "" });

  const createMutation = trpc.campaign.create.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      toast.success("战役创建成功");
      setShowForm(false);
      setForm({ name: "", description: "", gmId: "" });
    },
  });

  const statusColors: Record<string, string> = {
    preparing: "border-yellow-600 text-yellow-400",
    running: "border-emerald-600 text-emerald-400",
    paused: "border-orange-600 text-orange-400",
    finished: "border-zinc-600 text-zinc-400",
  };

  const statusLabels: Record<string, string> = {
    preparing: "准备中",
    running: "进行中",
    paused: "暂停",
    finished: "已结束",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">战役</h1>
          <p className="text-sm text-zinc-500 mt-1">管理跑团战役</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-amber-600 hover:bg-amber-700">
          {showForm ? "取消" : "新建战役"}
        </Button>
      </div>

      {showForm && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label className="text-zinc-300">战役名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="战役名称"
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
              />
            </div>
            <div>
              <Label className="text-zinc-300">描述</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="战役背景描述..."
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
              />
            </div>
            <div>
              <Label className="text-zinc-300">主持人</Label>
              <select
                value={form.gmId}
                onChange={(e) => setForm({ ...form, gmId: e.target.value })}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full rounded-md px-2 py-1.5 text-sm"
              >
                <option value="">选择主持人</option>
                {players?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => {
                if (!form.name) { toast.error("请输入名称"); return; }
                if (!form.gmId) { toast.error("请选择主持人"); return; }
                createMutation.mutate({
                  name: form.name,
                  description: form.description || undefined,
                  gmId: parseInt(form.gmId),
                });
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              创建
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="space-y-2">
          {campaigns.map((camp) => (
            <Card key={camp.id} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-zinc-100">{camp.name}</h3>
                    <Badge variant="outline" className={statusColors[camp.status] ?? ""}>
                      {statusLabels[camp.status] ?? camp.status}
                    </Badge>
                  </div>
                  {camp.description && (
                    <p className="text-xs text-zinc-500 mt-1">{camp.description}</p>
                  )}
                </div>
                <div className="text-xs text-zinc-600">
                  {camp.createdAt ? new Date(camp.createdAt).toLocaleDateString() : ""}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-zinc-500 text-center py-8">暂无战役</p>
      )}
    </div>
  );
}
