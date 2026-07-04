/**
 * 应用主路由
 */

import { Routes, Route } from "react-router";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import CharacterList from "@/pages/CharacterList";
import CharacterNew from "@/pages/CharacterNew";
import CharacterDetail from "@/pages/CharacterDetail";
import RollHistory from "@/pages/RollHistory";
import Campaigns from "@/pages/Campaigns";
import SceneRules from "@/pages/SceneRules";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/characters" element={<CharacterList />} />
        <Route path="/characters/new" element={<CharacterNew />} />
        <Route path="/characters/:id" element={<CharacterDetail />} />
        <Route path="/rolls" element={<RollHistory />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/rules" element={<SceneRules />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </AppLayout>
  );
}
