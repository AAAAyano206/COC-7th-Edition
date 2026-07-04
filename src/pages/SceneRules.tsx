/**
 * 特殊场景规则页
 */

import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function SceneRules() {
  const utils = trpc.useUtils();
  const { data: rules, isLoading } = trpc.sceneRule.list.useQuery({ activeOnly: false });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    affectedSkills: "",
    adjustType: "bonus" as "bonus" | "penalty" | "multiplier" | "auto_success" | "auto_fail",
    adjustValue: "0",
  });

  const createMutation = trpc.sceneRule.create.useMutation({
    onSuccess: () => {
      utils.sceneRule.list.invalidate();
      toast.success("规则已创建");
      setShowForm(false);
      setForm({ name: "", description: "", affectedSkills: "", adjustType: "bonus", adjustValue: "0" });
    },
  });

  const updateMutation = trpc.sceneRule.update.useMutation({
    onSuccess: () => {
      utils.sceneRule.list.invalidate();
      toast.success("规则已更新");
    },
  });

  const deleteMutation = trpc.sceneRule.delete.useMutation({
    onSuccess: () => {
      utils.sceneRule.list.invalidate();
      toast.success("规则已删除");
    },
  });

  const typeLabels: Record<string, string> = {
    bonus: "加值",
    penalty: "减值",
    multiplier: "倍率",
    auto_success: "自动成功",
    auto_fail: "自动失败",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">场景规则</h1>
          <p className="text-sm text-zinc-500 mt-1">定义特殊场景下的判定调整规则</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-amber-600 hover:bg-amber-700">
          {showForm ? "取消" : "新建规则"}
        </Button>
      </div>

      {showForm && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label className="text-zinc-300">规则名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如: 暴雨天气, 黑暗环境..."
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
              />
            </div>
            <div>
              <Label className="text-zinc-300">描述</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="规则描述..."
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
              />
            </div>
            <div>
              <Label className="text-zinc-300">影响技能 (逗号分隔)</Label>
              <Input
                value={form.affectedSkills}
                onChange={(e) => setForm({ ...form, affectedSkills: e.target.value })}
                placeholder="侦查,聆听,射击..."
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-zinc-300">调整类型</Label>
                <select
                  value={form.adjustType}
                  onChange={(e) => setForm({ ...form, adjustType: e.target.value as typeof form.adjustType })}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full rounded-md px-2 py-1.5 text-sm"
                >
                  <option value="bonus">加值</option>
                  <option value="penalty">减值</option>
                  <option value="multiplier">倍率</option>
                  <option value="auto_success">自动成功</option>
                  <option value="auto_fail">自动失败</option>
                </select>
              </div>
              <div>
                <Label className="text-zinc-300">调整值</Label>
                <Input
                  type="number"
                  value={form.adjustValue}
                  onChange={(e) => setForm({ ...form, adjustValue: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100"
                />
              </div>
            </div>
            <Button
              onClick={() => {
                if (!form.name) { toast.error("请输入名称"); return; }
                createMutation.mutate({
                  name: form.name,
                  description: form.description || undefined,
                  affectedSkills: form.affectedSkills || undefined,
                  adjustType: form.adjustType,
                  adjustValue: parseInt(form.adjustValue) || 0,
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
            <div key={i} className="h-16 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
      ) : rules && rules.length > 0 ? (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card key={rule.id} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-zinc-100">{rule.name}</h3>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                      {typeLabels[rule.adjustType] ?? rule.adjustType}
                      {rule.adjustValue ? ` ${rule.adjustValue > 0 ? "+" : ""}${rule.adjustValue}` : ""}
                    </Badge>
                    {rule.isActive ? (
                      <Badge variant="outline" className="text-[10px] border-emerald-700 text-emerald-400">
                        启用
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                        停用
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({ id: rule.id, isActive: checked })
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-red-800 text-red-400"
                      onClick={() => {
                        if (confirm("确定删除此规则？")) {
                          deleteMutation.mutate({ id: rule.id });
                        }
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
                {rule.description && (
                  <p className="text-xs text-zinc-500 mt-1">{rule.description}</p>
                )}
                {rule.affectedSkills && (
                  <p className="text-xs text-zinc-600 mt-1">
                    影响: {rule.affectedSkills}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-zinc-500 text-center py-8">暂无场景规则</p>
      )}
    </div>
  );
}
