/**
 * 角色卡详情页 - 完整版
 * 包含空白卡(CY22.2Plus)中的所有信息
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RESULT_LABELS } from "@contracts/coc";

const inputClass = "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600";

export default function CharacterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const charId = parseInt(id ?? "0");
  const utils = trpc.useUtils();

  const { data: character, isLoading } = trpc.character.getById.useQuery({ id: charId });
  const { data: rollHistory } = trpc.dice.getHistory.useQuery({ characterId: charId, limit: 20 });

  const modifyMutation = trpc.character.modifyAttribute.useMutation({
    onSuccess: () => { utils.character.getById.invalidate({ id: charId }); toast.success("已更新"); },
  });

  const upsertBgMutation = trpc.background.upsert.useMutation({
    onSuccess: () => { utils.character.getById.invalidate({ id: charId }); toast.success("背景已保存"); },
  });

  const skillCheckMutation = trpc.dice.skillCheck.useMutation({
    onSuccess: (data) => {
      if (data.success) { utils.dice.getHistory.invalidate(); toast.success(data.message ?? "检定完成"); }
      else { toast.error(data.message ?? "检定失败"); }
    },
  });

  const [bgForm, setBgForm] = useState<Record<string, string>>({});

  const handleSkillCheck = (name: string, _val: number, diff: "normal" | "hard" | "extreme" = "normal") => {
    skillCheckMutation.mutate({ characterId: charId, targetName: name, difficulty: diff });
  };

  const handleSaveBg = () => {
    upsertBgMutation.mutate({ characterId: charId, ...bgForm });
  };

  if (isLoading) return <div className="space-y-4"><div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" /><div className="h-96 w-full bg-zinc-800 rounded animate-pulse" /></div>;
  if (!character) return <div className="text-center py-12"><p className="text-zinc-500">未找到角色卡</p><Button variant="outline" className="mt-4 border-zinc-700" onClick={() => navigate("/characters")}>返回</Button></div>;

  const bg = character.background;
  const quickModify = (attr: string, op: "add" | "sub", val: number) => {
    modifyMutation.mutate({ id: charId, attribute: attr, operation: op === "add" ? "add" : "sub", value: val });
  };

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-100">{character.name}</h1>
            {character.isActive && <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/50">激活</Badge>}
            <Badge variant="outline" className="border-zinc-700 text-zinc-400">{character.era ?? "1920s"}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-zinc-500">
            {character.occupation && <span>职业: <span className="text-zinc-300">{character.occupation}</span></span>}
            {character.occupationCode && <span>序号: {character.occupationCode}</span>}
            {character.age && <span>年龄: {character.age}岁</span>}
            {character.gender && <span>性别: {character.gender}</span>}
            {character.residence && <span>住地: {character.residence}</span>}
            {character.birthplace && <span>故乡: {character.birthplace}</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" className="border-red-800 text-red-400" onClick={() => { if (confirm("删除角色卡?")) { trpc.character.delete.useMutation().mutate({ id: charId }); navigate("/characters"); } }}>删除</Button>
      </div>

      {/* 状态栏 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "HP", value: character.hp, max: character.maxHp, color: "bg-red-500", attr: "hp" },
          { label: "MP", value: character.mp, max: character.maxMp, color: "bg-blue-500", attr: "mp" },
          { label: "SAN", value: character.san, max: character.maxSan, color: "bg-purple-500", attr: "san" },
          { label: "LUCK", value: character.luck, max: 99, color: "bg-yellow-500", attr: "luck" },
        ].map((s) => (
          <Card key={s.label} className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-500">{s.label}</span>
                <span className="text-sm font-bold text-zinc-200">{s.value}/{s.max}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
                <div className={`h-full ${s.color} rounded-full`} style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%` }} />
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs border-zinc-700 flex-1" onClick={() => quickModify(s.attr, "sub", 1)}>-1</Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs border-zinc-700 flex-1" onClick={() => quickModify(s.attr, "add", 1)}>+1</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab 页 */}
      <Tabs defaultValue="attributes" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800 flex-wrap h-auto">
          <TabsTrigger value="attributes" className="data-[state=active]:bg-zinc-800">属性</TabsTrigger>
          <TabsTrigger value="skills" className="data-[state=active]:bg-zinc-800">技能</TabsTrigger>
          <TabsTrigger value="background" className="data-[state=active]:bg-zinc-800">背景</TabsTrigger>
          <TabsTrigger value="combat" className="data-[state=active]:bg-zinc-800">战斗装备</TabsTrigger>
          <TabsTrigger value="rolls" className="data-[state=active]:bg-zinc-800">检定记录</TabsTrigger>
        </TabsList>

        {/* 属性页 */}
        <TabsContent value="attributes" className="space-y-4">
          {/* 八大属性 */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-base text-zinc-100">八大属性</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                {[
                  { label: "STR", value: character.str, name: "力量" },
                  { label: "CON", value: character.con, name: "体质" },
                  { label: "SIZ", value: character.siz, name: "体型" },
                  { label: "DEX", value: character.dex, name: "敏捷" },
                  { label: "APP", value: character.app, name: "外貌" },
                  { label: "INT", value: character.int, name: "智力" },
                  { label: "POW", value: character.pow, name: "意志" },
                  { label: "EDU", value: character.edu, name: "教育" },
                ].map((a) => (
                  <button key={a.label} onClick={() => handleSkillCheck(a.name, a.value)} disabled={skillCheckMutation.isPending}
                    className="bg-zinc-950 rounded-lg p-3 text-center hover:bg-zinc-800 transition-colors group">
                    <div className="text-[10px] text-zinc-500">{a.label}</div>
                    <div className="text-lg font-bold text-zinc-200 group-hover:text-amber-400">{a.value}</div>
                    <div className="text-[9px] text-zinc-600">{a.name}</div>
                    <div className="text-[8px] text-zinc-600 opacity-0 group-hover:opacity-100">困{Math.floor(a.value / 2)}极{Math.floor(a.value / 5)}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 衍生属性 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "伤害加深 (DB)", value: character.db },
              { label: "体格 (BUILD)", value: character.build },
              { label: "移动 (MOV)", value: `${character.mov}${character.movAdjust ? `(${character.movAdjust >= 0 ? "+" : ""}${character.movAdjust})` : ""}` },
              { label: "重伤值", value: character.majorWound || Math.ceil(character.maxHp / 2) },
              { label: "临时HP", value: character.tempHp || 0 },
              { label: "今日SAN损失", value: character.sanLossToday || 0 },
              { label: "MP恢复/h", value: character.mpRegen || 1 },
              { label: "已用MP", value: character.usedMp || 0 },
            ].map((d) => (
              <div key={d.label} className="bg-zinc-950 rounded p-3 text-center">
                <div className="text-[10px] text-zinc-500">{d.label}</div>
                <div className="text-sm font-bold text-zinc-200">{d.value}</div>
              </div>
            ))}
          </div>

          {/* 护甲 */}
          {(character.armorType || character.armorValue > 0) && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-base text-zinc-100">护甲</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-zinc-500">类型:</span> <span className="text-zinc-300">{character.armorType ?? "无"}</span></div>
                <div><span className="text-zinc-500">护甲值:</span> <span className="text-zinc-300">{character.armorValue}</span></div>
                <div><span className="text-zinc-500">覆盖:</span> <span className="text-zinc-300">{character.armorCoverage ?? "—"}</span></div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 技能页 */}
        <TabsContent value="skills">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              {character.skills && character.skills.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {character.skills.sort((a, b) => b.finalValue - a.finalValue).map((s) => (
                    <div key={s.id} className="bg-zinc-950 rounded p-2.5 group hover:bg-zinc-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-300">{s.skillName}</span>
                        <div className="flex items-center gap-2">
                          {s.isOccupation && <Badge className="text-[8px] h-4 bg-amber-600/20 text-amber-400 border-amber-600/30">本职</Badge>}
                          <span className="text-sm font-bold text-amber-400">{s.finalValue}</span>
                        </div>
                      </div>
                      <div className="text-[9px] text-zinc-600">基础:{s.baseValue} 职业:{s.occupationPoints} 兴趣:{s.interestPoints}</div>
                      <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {["normal", "hard", "extreme"].map((d) => {
                          const label = d === "hard" ? "困难" : d === "extreme" ? "极难" : "普通";
                          const val = d === "hard" ? Math.floor(s.finalValue / 2) : d === "extreme" ? Math.floor(s.finalValue / 5) : s.finalValue;
                          return <button key={d} onClick={() => handleSkillCheck(s.skillName, s.finalValue, d as any)} disabled={skillCheckMutation.isPending} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:bg-amber-600/30 hover:text-amber-400">{label}({val})</button>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-zinc-500 text-center py-4">暂无技能</p>}
            </CardContent>
          </Card>

          {/* 自定义技能 */}
          {character.customSkills && character.customSkills.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800 mt-4">
              <CardHeader><CardTitle className="text-base text-zinc-100">自定义子技能</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {character.customSkills.map((s) => (
                  <div key={s.id} className="bg-zinc-950 rounded p-2">
                    <div className="text-[9px] text-zinc-500 uppercase">{s.category}</div>
                    <div className="text-sm text-zinc-300">{s.name} <span className="text-amber-400">{s.baseValue}</span></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 背景页 */}
        <TabsContent value="background" className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base text-zinc-100">背景故事</CardTitle>
              <Button size="sm" onClick={handleSaveBg} disabled={upsertBgMutation.isPending} className="bg-amber-600 hover:bg-amber-700">保存</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "appearance", label: "形象描述", placeholder: "调查员的外貌特征..." },
                { key: "beliefs", label: "信仰和思想", placeholder: "调查员的信念..." },
                { key: "significantPlaces", label: "意义非凡之地", placeholder: "对调查员有特殊意义的地点..." },
                { key: "treasuredPossessions", label: "宝贵之物", placeholder: "调查员珍视的物品..." },
                { key: "traits", label: "特质", placeholder: "调查员的性格特征..." },
                { key: "woundsAndScars", label: "伤口和疤痕", placeholder: "身上的伤痕..." },
                { key: "phobiasAndManias", label: "恐惧症和躁狂症", placeholder: "恐惧症和躁狂症..." },
                { key: "tomesSpellsAndEncounters", label: "典籍、法术和怪奇事件", placeholder: "接触过的神秘知识..." },
                { key: "extraStory", label: "额外背景故事", placeholder: "更多背景..." },
              ].map((field) => (
                <div key={field.key}>
                  <Label className="text-xs text-zinc-400">{field.label}</Label>
                  <textarea
                    defaultValue={bg?.[field.key as keyof typeof bg] as string ?? ""}
                    onChange={(e) => setBgForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className={`${inputClass} w-full rounded-md px-2 py-1.5 text-sm min-h-[60px] resize-y`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 同伴 */}
          {character.companions && character.companions.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-base text-zinc-100">调查员同伴</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {character.companions.map((c) => (
                  <div key={c.id} className="bg-zinc-950 rounded p-3">
                    <div className="text-sm text-zinc-300 font-bold">{c.name}</div>
                    {c.relationship && <div className="text-xs text-zinc-500">{c.relationship}</div>}
                    {c.description && <div className="text-xs text-zinc-400 mt-1">{c.description}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 自定义状态 */}
          {character.customStatus && character.customStatus.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-base text-zinc-100">自定义状态</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {character.customStatus.map((s) => (
                  <div key={s.id} className={`rounded p-3 ${s.type === "physical" ? "bg-red-950/30 border border-red-900/30" : "bg-purple-950/30 border border-purple-900/30"}`}>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[8px] ${s.type === "physical" ? "bg-red-600/20 text-red-400" : "bg-purple-600/20 text-purple-400"}`}>{s.type === "physical" ? "身体" : "精神"}</Badge>
                      <span className="text-sm text-zinc-200">{s.name}</span>
                    </div>
                    {s.sanLoss && <div className="text-xs text-zinc-500 mt-1">SAN损失: {s.sanLoss}</div>}
                    {s.description && <div className="text-xs text-zinc-400 mt-1">{s.description}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 战斗装备页 */}
        <TabsContent value="combat" className="space-y-4">
          {/* 武器 */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-base text-zinc-100">武器</CardTitle></CardHeader>
            <CardContent>
              {character.weapons && character.weapons.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-zinc-500 text-[10px]"><th className="text-left">名称</th><th>伤害</th><th>攻击次数</th><th>射程</th><th>故障值</th><th>弹药</th><th>贯穿</th></tr></thead>
                    <tbody>
                      {character.weapons.map((w) => (
                        <tr key={w.id} className="border-t border-zinc-800">
                          <td className="py-2 text-zinc-300">{w.name}</td>
                          <td className="py-2 text-center text-amber-400">{w.damage ?? "—"}</td>
                          <td className="py-2 text-center text-zinc-400">{w.attacks ?? "—"}</td>
                          <td className="py-2 text-center text-zinc-400">{w.range ?? "—"}</td>
                          <td className="py-2 text-center text-zinc-400">{w.malfunction ?? "—"}</td>
                          <td className="py-2 text-center text-zinc-400">{w.currentAmmo ?? "—"}/{w.ammoCapacity ?? "—"}</td>
                          <td className="py-2 text-center">{w.impale ? "是" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-zinc-500 text-center py-4">暂无武器</p>}
            </CardContent>
          </Card>

          {/* 装备 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-base text-zinc-100">装备与道具</CardTitle></CardHeader>
              <CardContent>
                {character.equipment?.filter((e) => e.type === "gear").length ?? 0 > 0 ? (
                  <div className="space-y-1">
                    {character.equipment?.filter((e) => e.type === "gear").map((e) => (
                      <div key={e.id} className="flex justify-between text-sm"><span className="text-zinc-300">{e.name}</span>{e.quantity > 1 && <span className="text-zinc-500">x{e.quantity}</span>}</div>
                    ))}
                  </div>
                ) : <p className="text-sm text-zinc-500 text-center py-4">暂无装备</p>}
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-base text-zinc-100">个人物品</CardTitle></CardHeader>
              <CardContent>
                {character.equipment?.filter((e) => e.type === "personal").length ?? 0 > 0 ? (
                  <div className="space-y-1">
                    {character.equipment?.filter((e) => e.type === "personal").map((e) => (
                      <div key={e.id} className="flex justify-between text-sm"><span className="text-zinc-300">{e.name}</span>{e.quantity > 1 && <span className="text-zinc-500">x{e.quantity}</span>}</div>
                    ))}
                  </div>
                ) : <p className="text-sm text-zinc-500 text-center py-4">暂无个人物品</p>}
              </CardContent>
            </Card>
          </div>

          {/* 资产 */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-base text-zinc-100">资产</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-zinc-950 rounded p-3"><div className="text-[10px] text-zinc-500">现金</div><div className="text-sm font-bold text-zinc-200">${character.cash ?? 0}</div></div>
              <div className="bg-zinc-950 rounded p-3"><div className="text-[10px] text-zinc-500">消费水平</div><div className="text-sm font-bold text-zinc-200">${character.spendingLevel ?? 0}</div></div>
              <div className="bg-zinc-950 rounded p-3"><div className="text-[10px] text-zinc-500">总资产</div><div className="text-sm font-bold text-zinc-200">${character.assets ?? 0}</div></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 检定记录 */}
        <TabsContent value="rolls">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-base text-zinc-100">最近检定</CardTitle></CardHeader>
            <CardContent>
              {rollHistory && rollHistory.length > 0 ? (
                <div className="space-y-1">
                  {rollHistory.map((roll) => (
                    <div key={roll.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-zinc-800">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${roll.result === "critical" ? "border-yellow-600 text-yellow-400" : roll.result === "fumble" ? "border-red-600 text-red-400" : ["success", "hard_success", "extreme_success"].includes(roll.result) ? "border-emerald-600 text-emerald-400" : "border-zinc-700 text-zinc-400"}`}>
                          {RESULT_LABELS[roll.result as keyof typeof RESULT_LABELS] ?? roll.result}
                        </Badge>
                        <span className="text-sm text-zinc-300">{roll.targetName}</span>
                        <span className="text-xs text-zinc-500">D100={roll.rollResult}/{roll.targetValue}</span>
                      </div>
                      <span className="text-xs text-zinc-600">{roll.createdAt ? new Date(roll.createdAt).toLocaleString() : ""}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-zinc-500 text-center py-4">暂无检定记录</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
