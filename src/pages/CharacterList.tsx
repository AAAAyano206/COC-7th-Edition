/**
 * 角色卡列表页
 * 显示所有角色卡，支持搜索和筛选
 */

import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function CharacterList() {
  const { data: characters, isLoading } = trpc.character.list.useQuery({});
  const [search, setSearch] = useState("");

  const filtered = characters?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">角色卡</h1>
          <p className="text-sm text-zinc-500 mt-1">管理调查员角色卡</p>
        </div>
        <Link to="/characters/new">
          <Button className="bg-amber-600 hover:bg-amber-700">新建角色卡</Button>
        </Link>
      </div>

      {/* 搜索 */}
      <Input
        placeholder="搜索角色卡..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
      />

      {/* 角色卡列表 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((char) => (
            <Link key={char.id} to={`/characters/${char.id}`}>
              <Card className="bg-zinc-900 border-zinc-800 hover:border-amber-600/50 transition-all cursor-pointer group">
                <CardContent className="p-4 space-y-3">
                  {/* 名称和职业 */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">
                        {char.name}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {char.occupation ?? "无职业"}
                        {char.age ? ` · ${char.age}岁` : ""}
                      </p>
                    </div>
                    {char.isActive && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-emerald-600 text-emerald-400"
                      >
                        激活
                      </Badge>
                    )}
                  </div>

                  {/* 属性概览 */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-zinc-950 rounded p-1.5">
                      <div className="text-[10px] text-zinc-500">STR</div>
                      <div className="text-sm font-bold text-zinc-200">{char.str}</div>
                    </div>
                    <div className="bg-zinc-950 rounded p-1.5">
                      <div className="text-[10px] text-zinc-500">DEX</div>
                      <div className="text-sm font-bold text-zinc-200">{char.dex}</div>
                    </div>
                    <div className="bg-zinc-950 rounded p-1.5">
                      <div className="text-[10px] text-zinc-500">INT</div>
                      <div className="text-sm font-bold text-zinc-200">{char.int}</div>
                    </div>
                    <div className="bg-zinc-950 rounded p-1.5">
                      <div className="text-[10px] text-zinc-500">POW</div>
                      <div className="text-sm font-bold text-zinc-200">{char.pow}</div>
                    </div>
                  </div>

                  {/* 状态条 */}
                  <div className="space-y-1.5">
                    {/* HP */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 w-6">HP</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full transition-all"
                          style={{
                            width: `${(char.hp / char.maxHp) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400 w-12 text-right">
                        {char.hp}/{char.maxHp}
                      </span>
                    </div>
                    {/* MP */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 w-6">MP</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{
                            width: `${(char.mp / char.maxMp) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400 w-12 text-right">
                        {char.mp}/{char.maxMp}
                      </span>
                    </div>
                    {/* SAN */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 w-6">SAN</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{
                            width: `${(char.san / char.maxSan) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400 w-12 text-right">
                        {char.san}/{char.maxSan}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-zinc-500 mb-4">
            {search ? "没有匹配的角色卡" : "还没有角色卡"}
          </p>
          <Link to="/characters/new">
            <Button className="bg-amber-600 hover:bg-amber-700">创建角色卡</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
