/**
 * tRPC 主路由注册
 * 汇总所有功能模块的 router
 */

import { createRouter, publicQuery } from "./middleware";
import { characterRouter } from "./routers/character";
import { diceRouter } from "./routers/dice";
import { playerRouter } from "./routers/player";
import { campaignRouter } from "./routers/campaign";
import { sceneRuleRouter } from "./routers/sceneRule";
import { oopzRouter } from "./routers/oopz";
import {
  backgroundRouter,
  weaponRouter,
  equipmentRouter,
  companionRouter,
  customSkillRouter,
  customStatusRouter,
  experiencePackRouter,
} from "./routers/characterCard";

export const appRouter = createRouter({
  // 健康检查
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  // 角色卡管理
  character: characterRouter,

  // 角色卡附属数据
  background: backgroundRouter,
  weapon: weaponRouter,
  equipment: equipmentRouter,
  companion: companionRouter,
  customSkill: customSkillRouter,
  customStatus: customStatusRouter,
  experiencePack: experiencePackRouter,

  // 骰子投掷与检定
  dice: diceRouter,

  // 玩家管理
  player: playerRouter,

  // 战役管理
  campaign: campaignRouter,

  // 特殊场景规则
  sceneRule: sceneRuleRouter,

  // Oopz Bot 指令处理
  oopz: oopzRouter,
});

export type AppRouter = typeof appRouter;
