/**
 * 新建角色卡页面
 * 支持手动填写和文本导入(.st格式)两种方式
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function CharacterNew() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  // 手动创建
  const [form, setForm] = useState({
    name: "",
    occupation: "",
    age: "",
    gender: "",
    str: "50",
    con: "50",
    siz: "50",
    dex: "50",
    app: "50",
    int: "50",
    pow: "50",
    edu: "50",
    luck: "50",
    description: "",
  });

  // 文本导入
  const [importText, setImportText] = useState("");
  const [importName, setImportName] = useState("");

  const createMutation = trpc.character.create.useMutation({
    onSuccess: () => {
      utils.character.list.invalidate();
      toast.success("角色卡创建成功");
      navigate("/characters");
    },
    onError: (err) => {
      toast.error("创建失败: " + err.message);
    },
  });

  const importMutation = trpc.character.importFromText.useMutation({
    onSuccess: () => {
      utils.character.list.invalidate();
      toast.success("角色卡导入成功");
      navigate("/characters");
    },
    onError: (err) => {
      toast.error("导入失败: " + err.message);
    },
  });

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error("请输入角色名称");
      return;
    }
    createMutation.mutate({
      name: form.name,
      occupation: form.occupation || undefined,
      age: form.age ? parseInt(form.age) : undefined,
      gender: form.gender || undefined,
      str: parseInt(form.str) || 50,
      con: parseInt(form.con) || 50,
      siz: parseInt(form.siz) || 50,
      dex: parseInt(form.dex) || 50,
      app: parseInt(form.app) || 50,
      int: parseInt(form.int) || 50,
      pow: parseInt(form.pow) || 50,
      edu: parseInt(form.edu) || 50,
      luck: parseInt(form.luck) || 50,
      description: form.description || undefined,
    });
  };

  const handleImport = () => {
    if (!importName.trim()) {
      toast.error("请输入角色名称");
      return;
    }
    if (!importText.trim()) {
      toast.error("请输入属性文本");
      return;
    }
    importMutation.mutate({
      text: importText,
      name: importName,
    });
  };

  const inputClass =
    "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600";

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">新建角色卡</h1>
        <p className="text-sm text-zinc-500 mt-1">创建新的调查员角色卡</p>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="manual" className="data-[state=active]:bg-zinc-800">
            手动填写
          </TabsTrigger>
          <TabsTrigger value="import" className="data-[state=active]:bg-zinc-800">
            文本导入
          </TabsTrigger>
        </TabsList>

        {/* 手动填写 */}
        <TabsContent value="manual">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">基础信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">角色名称 *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="调查员姓名"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">职业</Label>
                  <Input
                    value={form.occupation}
                    onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                    placeholder="职业"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">年龄</Label>
                  <Input
                    type="number"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    placeholder="25"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">性别</Label>
                  <Input
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    placeholder="男/女"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">幸运</Label>
                  <Input
                    type="number"
                    value={form.luck}
                    onChange={(e) => setForm({ ...form, luck: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">背景描述</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="角色背景故事..."
                  className={`${inputClass} min-h-[80px]`}
                />
              </div>
            </CardContent>

            <CardHeader>
              <CardTitle className="text-base text-zinc-100">基础属性</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { key: "str", label: "STR 力量" },
                  { key: "con", label: "CON 体质" },
                  { key: "siz", label: "SIZ 体型" },
                  { key: "dex", label: "DEX 敏捷" },
                  { key: "app", label: "APP 外貌" },
                  { key: "int", label: "INT 智力" },
                  { key: "pow", label: "POW 意志" },
                  { key: "edu", label: "EDU 教育" },
                ].map((attr) => (
                  <div key={attr.key} className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">{attr.label}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={form[attr.key as keyof typeof form]}
                      onChange={(e) =>
                        setForm({ ...form, [attr.key]: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </CardContent>

            <CardContent>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                {createMutation.isPending ? "创建中..." : "创建角色卡"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 文本导入 */}
        <TabsContent value="import">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">
                从文本导入 (.st 格式)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">角色名称 *</Label>
                <Input
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="调查员姓名"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">属性文本</Label>
                <Textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder=".st 力量40敏捷70意志45体质60外貌60教育70体型60智力90幸运50..."
                  className={`${inputClass} min-h-[200px] font-mono text-sm`}
                />
                <p className="text-xs text-zinc-500">
                  支持格式: 属性名+数值 或 属性名+空格+数值
                </p>
              </div>

              <Button
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                {importMutation.isPending ? "导入中..." : "导入角色卡"}
              </Button>

              <div className="p-3 bg-zinc-950 rounded text-xs text-zinc-500">
                <p className="font-semibold text-zinc-400 mb-1">示例格式:</p>
                <p>.st 力量40str40敏捷70dex70意志45pow45体质60con60外貌60app60</p>
                <p>.st 教育70edu70体型60siz60智力90int90幸运50luck50</p>
                <p className="mt-1">会自动计算: HP、MP、SAN、MOV、BUILD、DB</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
