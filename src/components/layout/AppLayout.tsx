/**
 * 应用主布局
 * 包含侧边栏导航和主内容区域
 */

import { Link, useLocation } from "react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";

// 导航项定义
const navItems = [
  { path: "/", label: "仪表板", icon: "□" },
  { path: "/characters", label: "角色卡", icon: "👤" },
  { path: "/rolls", label: "检定记录", icon: "🎲" },
  { path: "/campaigns", label: "战役", icon: "⚔" },
  { path: "/rules", label: "场景规则", icon: "📜" },
  { path: "/settings", label: "设置", icon: "⚙" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* 侧边栏 */}
      <aside className="w-56 flex-shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col">
        {/* Logo */}
        <div className="p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-amber-600 flex items-center justify-center text-sm font-bold">
            COC
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-100">跑团助手</h1>
            <p className="text-[10px] text-zinc-500">COC 7th Edition</p>
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        {/* 导航 */}
        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-amber-600/15 text-amber-400 border border-amber-600/30"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <Separator className="bg-zinc-800" />

        {/* 底部信息 */}
        <div className="p-3 text-[10px] text-zinc-600">
          <p>COC 7th Edition</p>
          <p>Call of Cthulhu</p>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-6xl mx-auto">{children}</div>
        </ScrollArea>
      </main>

      <Toaster />
    </div>
  );
}
