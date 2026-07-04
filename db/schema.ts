/**
 * COC 跑团助手 - 数据库 Schema
 * 包含角色卡、玩家、技能、检定记录、特殊场景规则等核心表
 */

import {
  mysqlTable,
  serial,
  varchar,
  text,
  int,
  timestamp,
  boolean,
  mysqlEnum,
  bigint,
} from "drizzle-orm/mysql-core";

// ==================== 玩家表 ====================
export const players = mysqlTable("players", {
  id: serial("id").primaryKey(),
  // Oopz 平台用户ID（用于关联Oopz用户）
  oopzUserId: varchar("oopz_user_id", { length: 64 }).unique(),
  // 玩家昵称
  nickname: varchar("nickname", { length: 100 }).notNull(),
  // 是否GM（主持人）
  isGm: boolean("is_gm").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 战役/团表 ====================
export const campaigns = mysqlTable("campaigns", {
  id: serial("id").primaryKey(),
  // 战役名称
  name: varchar("name", { length: 200 }).notNull(),
  // 战役描述
  description: text("description"),
  // 主持人ID
  gmId: bigint("gm_id", { mode: "number", unsigned: true }).notNull(),
  // 战役状态
  status: mysqlEnum("status", ["preparing", "running", "paused", "finished"])
    .notNull()
    .default("preparing"),
  // 当前场景
  currentScene: varchar("current_scene", { length: 200 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 角色卡表 ====================
export const characters = mysqlTable("characters", {
  id: serial("id").primaryKey(),
  // 角色名称
  name: varchar("name", { length: 100 }).notNull(),
  // 玩家ID
  playerId: bigint("player_id", { mode: "number", unsigned: true }),
  // 所属战役ID
  campaignId: bigint("campaign_id", { mode: "number", unsigned: true }),
  // 角色描述/背景
  description: text("description"),
  // 职业
  occupation: varchar("occupation", { length: 100 }),
  // 职业序号（用于职业模板引用）
  occupationCode: varchar("occupation_code", { length: 20 }),
  // 年龄
  age: int("age"),
  // 性别
  gender: varchar("gender", { length: 10 }),
  // 时代背景（如 1920s, 现代, 1890s 等）
  era: varchar("era", { length: 50 }).default("1920s"),
  // 住地
  residence: varchar("residence", { length: 200 }),
  // 故乡
  birthplace: varchar("birthplace", { length: 200 }),
  // 现时间（游戏内时间）
  gameYear: int("game_year"),
  gameMonth: int("game_month"),
  gameDay: int("game_day"),
  gameTime: varchar("game_time", { length: 20 }),
  // 调查员肖像/形象描述URL
  portraitUrl: text("portrait_url"),

  // ===== 基础属性 (COC 7版) =====
  str: int("str").notNull().default(50), // 力量
  con: int("con").notNull().default(50), // 体质
  siz: int("siz").notNull().default(50), // 体型
  dex: int("dex").notNull().default(50), // 敏捷
  app: int("app").notNull().default(50), // 外貌
  int: int("intelligence").notNull().default(50), // 智力
  pow: int("pow").notNull().default(50), // 意志
  edu: int("edu").notNull().default(50), // 教育
  luck: int("luck").notNull().default(50), // 幸运

  // ===== 衍生属性 =====
  hp: int("hp").notNull().default(10), // 当前生命值
  maxHp: int("max_hp").notNull().default(10), // 最大生命值
  tempHp: int("temp_hp").notNull().default(0), // 临时生命值
  majorWound: int("major_wound").notNull().default(0), // 重伤值 threshold
  mp: int("mp").notNull().default(10), // 当前魔法值
  maxMp: int("max_mp").notNull().default(10), // 最大魔法值
  usedMp: int("used_mp").notNull().default(0), // 已使用的魔法值
  mpRegen: int("mp_regen").notNull().default(1), // 每小时恢复MP
  san: int("san").notNull().default(50), // 当前理智值
  maxSan: int("max_san").notNull().default(99), // 最大理智值
  sanLossToday: int("san_loss_today").notNull().default(0), // 今日SAN损失
  startingSan: int("starting_san").notNull().default(0), // 游戏开始时的SAN
  mov: int("mov").notNull().default(8), // 移动速度
  movAdjust: int("mov_adjust").notNull().default(0), // MOV调整值（年龄减值）
  build: int("build").notNull().default(0), // 体格
  db: varchar("db", { length: 10 }).notNull().default("+0"), // 伤害加成

  // ===== 护甲 =====
  armorType: varchar("armor_type", { length: 100 }), // 护甲类型
  armorValue: int("armor_value").notNull().default(0), // 护甲值
  armorCoverage: varchar("armor_coverage", { length: 200 }), // 覆盖部位
  armorPenalty: int("armor_penalty").notNull().default(0), // 护甲减值

  // ===== 资产 =====
  cash: int("cash").notNull().default(0), // 现金
  spendingLevel: int("spending_level").notNull().default(0), // 消费水平
  assets: int("assets").notNull().default(0), // 总资产

  // 是否激活（当前使用的角色卡）
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 角色技能表 ====================
export const characterSkills = mysqlTable("character_skills", {
  id: serial("id").primaryKey(),
  // 关联角色卡
  characterId: bigint("character_id", { mode: "number", unsigned: true }).notNull(),
  // 技能名称
  skillName: varchar("skill_name", { length: 100 }).notNull(),
  // 技能分类
  category: varchar("category", { length: 50 }),
  // 基础成功率
  baseValue: int("base_value").notNull().default(0),
  // 职业点数
  occupationPoints: int("occupation_points").notNull().default(0),
  // 兴趣点数
  interestPoints: int("interest_points").notNull().default(0),
  // 最终值 = baseValue + occupationPoints + interestPoints
  finalValue: int("final_value").notNull().default(0),
  // 是否为准则技能（职业技能）
  isOccupation: boolean("is_occupation").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 投掷记录表 ====================
export const rollHistory = mysqlTable("roll_history", {
  id: serial("id").primaryKey(),
  // 投掷类型
  rollType: mysqlEnum("roll_type", [
    "skill",      // 技能检定
    "attribute",  // 属性检定
    "san_check",  // 理智检定
    "damage",     // 伤害投掷
    "initiative", // 先攻
    "custom",     // 自定义
  ]).notNull(),
  // 关联角色卡
  characterId: bigint("character_id", { mode: "number", unsigned: true }),
  // 关联战役
  campaignId: bigint("campaign_id", { mode: "number", unsigned: true }),
  // 玩家ID
  playerId: bigint("player_id", { mode: "number", unsigned: true }),
  // 技能/属性名称
  targetName: varchar("target_name", { length: 100 }),
  // 目标值
  targetValue: int("target_value"),
  // 投掷结果 (d100)
  rollResult: int("roll_result").notNull(),
  // 判定难度: normal(普通), hard(困难), extreme(极难)
  difficulty: mysqlEnum("difficulty", ["normal", "hard", "extreme"])
    .notNull()
    .default("normal"),
  // 判定结果: fumble(大失败), failure(失败), success(成功), hard_success(困难成功), extreme_success(极难成功), critical(大成功)
  result: mysqlEnum("result", [
    "fumble",
    "failure",
    "success",
    "hard_success",
    "extreme_success",
    "critical",
  ]).notNull(),
  // 奖励/惩罚骰数量 (-2到+2)
  bonusDice: int("bonus_dice").notNull().default(0),
  // 场景规则名称（如有应用）
  sceneRuleName: varchar("scene_rule_name", { length: 100 }),
  // 详细日志
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==================== 特殊场景规则表 ====================
export const sceneRules = mysqlTable("scene_rules", {
  id: serial("id").primaryKey(),
  // 规则名称
  name: varchar("name", { length: 100 }).notNull(),
  // 规则描述
  description: text("description"),
  // 影响的技能列表（JSON数组）
  affectedSkills: text("affected_skills"),
  // 调整类型: bonus(加值), penalty(减值), multiplier(倍率), auto_success(自动成功), auto_fail(自动失败)
  adjustType: mysqlEnum("adjust_type", [
    "bonus",
    "penalty",
    "multiplier",
    "auto_success",
    "auto_fail",
  ]).notNull(),
  // 调整值
  adjustValue: int("adjust_value").notNull().default(0),
  // 是否启用
  isActive: boolean("is_active").notNull().default(true),
  // 关联战役
  campaignId: bigint("campaign_id", { mode: "number", unsigned: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 背景故事表 ====================
export const characterBackgrounds = mysqlTable("character_backgrounds", {
  id: serial("id").primaryKey(),
  characterId: bigint("character_id", { mode: "number", unsigned: true }).notNull(),
  // 形象描述
  appearance: text("appearance"),
  // 信仰和思想
  beliefs: text("beliefs"),
  // 意义非凡之地
  significantPlaces: text("significant_places"),
  // 宝贵之物
  treasuredPossessions: text("treasured_possessions"),
  // 特质
  traits: text("traits"),
  // 伤口和疤痕
  woundsAndScars: text("wounds_and_scars"),
  // 恐惧症和躁狂症
  phobiasAndManias: text("phobias_and_manias"),
  // 典籍、法术和怪奇事件
  tomesSpellsAndEncounters: text("tomes_spells_and_encounters"),
  // 额外背景故事
  extraStory: text("extra_story"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 武器表 ====================
export const weapons = mysqlTable("weapons", {
  id: serial("id").primaryKey(),
  characterId: bigint("character_id", { mode: "number", unsigned: true }).notNull(),
  // 武器名称
  name: varchar("name", { length: 100 }).notNull(),
  // 伤害
  damage: varchar("damage", { length: 50 }),
  // 攻击次数
  attacks: varchar("attacks", { length: 20 }),
  // 射程
  range: varchar("range", { length: 50 }),
  // 故障值
  malfunction: int("malfunction"),
  // 弹药容量
  ammoCapacity: int("ammo_capacity"),
  // 当前弹药
  currentAmmo: int("current_ammo"),
  // 是否贯穿
  impale: boolean("impale").notNull().default(false),
  // 备注
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 装备/物品表 ====================
export const equipment = mysqlTable("equipment", {
  id: serial("id").primaryKey(),
  characterId: bigint("character_id", { mode: "number", unsigned: true }).notNull(),
  // 物品名称
  name: varchar("name", { length: 200 }).notNull(),
  // 数量
  quantity: int("quantity").notNull().default(1),
  // 描述/备注
  description: text("description"),
  // 物品类型: gear(装备), personal(个人物品)
  type: mysqlEnum("type", ["gear", "personal"]).notNull().default("gear"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 调查员同伴表 ====================
export const companions = mysqlTable("companions", {
  id: serial("id").primaryKey(),
  characterId: bigint("character_id", { mode: "number", unsigned: true }).notNull(),
  // 同伴名称
  name: varchar("name", { length: 100 }).notNull(),
  // 关系
  relationship: varchar("relationship", { length: 100 }),
  // 描述
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 自定义子技能表 ====================
export const customSkills = mysqlTable("custom_skills", {
  id: serial("id").primaryKey(),
  characterId: bigint("character_id", { mode: "number", unsigned: true }).notNull(),
  // 技能分类: art(技艺), fighting(格斗), firearm(射击), drive(驾驶), science(科学)
  category: mysqlEnum("category", ["art", "fighting", "firearm", "drive", "science"]).notNull(),
  // 技能名称
  name: varchar("name", { length: 100 }).notNull(),
  // 基础值
  baseValue: int("base_value").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 自定义状态表 ====================
export const customStatus = mysqlTable("custom_status", {
  id: serial("id").primaryKey(),
  characterId: bigint("character_id", { mode: "number", unsigned: true }).notNull(),
  // 状态类型: physical(身体状态), mental(精神状态)
  type: mysqlEnum("type", ["physical", "mental"]).notNull(),
  // 状态名称
  name: varchar("name", { length: 100 }).notNull(),
  // SAN值减少
  sanLoss: int("san_loss"),
  // 技能增长
  skillGrowth: text("skill_growth"),
  // 描述
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 经历包表 ====================
export const experiencePacks = mysqlTable("experience_packs", {
  id: serial("id").primaryKey(),
  characterId: bigint("character_id", { mode: "number", unsigned: true }).notNull(),
  // 经历包名称
  name: varchar("name", { length: 100 }).notNull(),
  // 描述
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 战役-玩家关联表 ====================
export const campaignPlayers = mysqlTable("campaign_players", {
  id: serial("id").primaryKey(),
  campaignId: bigint("campaign_id", { mode: "number", unsigned: true }).notNull(),
  playerId: bigint("player_id", { mode: "number", unsigned: true }).notNull(),
  // 玩家角色
  role: mysqlEnum("role", ["gm", "player", "observer"])
    .notNull()
    .default("player"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});
