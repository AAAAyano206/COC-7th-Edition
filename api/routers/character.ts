/**
 * 角色卡管理 Router
 * 核心功能：角色卡CRUD、从文本导入(.st格式)、属性修改、技能管理
 */

import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  characters, characterSkills,
  characterBackgrounds, weapons, equipment,
  companions, customSkills, customStatus, experiencePacks
} from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  SKILL_NAME_MAP,
  ATTR_NAME_MAP,
  STANDARD_SKILLS,
} from "@contracts/coc";

// ===== 工具函数 =====

/**
 * 解析 .st 格式的属性录入文本
 * 支持格式: .st 力量40敏捷70意志45体质60外貌60教育70体型60智力90
 * 也支持: .st 力量 40 str 40 dex 70
 */
export function parseAttributesText(text: string): {
  attributes: Record<string, number>;
  skills: Record<string, number>;
  parsed: string[];
  failed: string[];
} {
  const attributes: Record<string, number> = {};
  const skills: Record<string, number> = {};
  const parsed: string[] = [];
  const failed: string[] = [];

  // 清理文本
  const cleanText = text
    .replace(/^\.st\s*/i, "")
    .replace(/^\.set\s*/i, "")
    .trim();

  // 匹配模式: 名称+数字 或 名称+空格+数字
  // 支持: 力量40, 力量 40, str40, str 40
  const regex = /([\u4e00-\u9fa5a-zA-Z_]+)\s*(\d+)/g;
  let match;

  while ((match = regex.exec(cleanText)) !== null) {
    const name = match[1].trim().toLowerCase();
    const value = parseInt(match[2]);

    if (isNaN(value)) continue;

    // 检查是否为属性
    const attrKey = Object.keys(ATTR_NAME_MAP).find(
      (k) => k.toLowerCase() === name
    );
    if (attrKey) {
      const attrName = ATTR_NAME_MAP[attrKey];
      // 标准化属性名
      const attrMap: Record<string, string> = {
        力量: "str",
        体质: "con",
        体型: "siz",
        敏捷: "dex",
        外貌: "app",
        智力: "int",
        意志: "pow",
        教育: "edu",
        幸运: "luck",
        体力: "hp",
        魔法: "mp",
        理智: "san",
        移动力: "mov",
        体格: "build",
      };
      const dbField = attrMap[attrName];
      if (dbField) {
        attributes[dbField] = value;
        parsed.push(`${attrName}:${value}`);
        continue;
      }
    }

    // 检查是否为技能
    const skillKey = Object.keys(SKILL_NAME_MAP).find(
      (k) => k.toLowerCase() === name
    );
    if (skillKey) {
      const skillName = SKILL_NAME_MAP[skillKey];
      skills[skillName] = value;
      parsed.push(`${skillName}:${value}`);
      continue;
    }

    // 尝试模糊匹配技能（中文名称）
    const fuzzySkill = Object.entries(STANDARD_SKILLS).find(([key]) =>
      key.includes(name) || name.includes(key)
    );
    if (fuzzySkill) {
      skills[fuzzySkill[0]] = value;
      parsed.push(`${fuzzySkill[0]}:${value}`);
      continue;
    }

    failed.push(name);
  }

  return { attributes, skills, parsed, failed };
}

/**
 * 计算衍生属性
 */
export function calculateDerived(
  str: number,
  con: number,
  siz: number,
  dex: number,
  pow: number
): {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  san: number;
  maxSan: number;
  mov: number;
  build: number;
  db: string;
} {
  // HP = (CON + SIZ) / 10 向下取整
  const maxHp = Math.floor((con + siz) / 10);
  // MP = POW / 5 向下取整
  const maxMp = Math.floor(pow / 5);
  // SAN = POW（初始）
  const maxSan = 99; // 最大SAN通常为99，除非有克苏鲁神话技能
  const san = pow;
  // MOV 基础为8，根据STR+DEX和SIZ调整
  let mov = 8;
  if (str + dex < siz) mov = 7;
  if (str + dex > siz * 2) mov = 9;
  // BUILD 和 DB
  let build = 0;
  let db = "+0";
  const strSiz = str + siz;
  if (strSiz >= 164 && strSiz <= 204) {
    build = 1;
    db = "+1d4";
  } else if (strSiz >= 205 && strSiz <= 284) {
    build = 2;
    db = "+1d6";
  } else if (strSiz >= 285 && strSiz <= 364) {
    build = 3;
    db = "+2d6";
  } else if (strSiz >= 365) {
    build = 4;
    db = "+3d6";
  } else if (strSiz <= 64) {
    build = -2;
    db = "-2";
  } else if (strSiz <= 84) {
    build = -1;
    db = "-1";
  }

  return {
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    san,
    maxSan,
    mov,
    build,
    db,
  };
}

// ===== tRPC Router =====

export const characterRouter = createRouter({
  /**
   * 列出角色卡
   */
  list: publicQuery
    .input(
      z.object({
        playerId: z.number().optional(),
        campaignId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      let query = db.select().from(characters);

      if (input.playerId) {
        query = query.where(eq(characters.playerId, input.playerId)) as typeof query;
      }
      if (input.campaignId) {
        query = query.where(eq(characters.campaignId, input.campaignId)) as typeof query;
      }

      return query.orderBy(desc(characters.createdAt));
    }),

  /**
   * 获取单个角色卡（含技能）
   */
  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const char = await db
        .select()
        .from(characters)
        .where(eq(characters.id, input.id))
        .limit(1);

      if (char.length === 0) return null;

      const [skills, background, weaponsList, equipList, companionsList, customSkillList, statusList, packsList] = await Promise.all([
        db.select().from(characterSkills).where(eq(characterSkills.characterId, input.id)),
        db.select().from(characterBackgrounds).where(eq(characterBackgrounds.characterId, input.id)).limit(1),
        db.select().from(weapons).where(eq(weapons.characterId, input.id)),
        db.select().from(equipment).where(eq(equipment.characterId, input.id)),
        db.select().from(companions).where(eq(companions.characterId, input.id)),
        db.select().from(customSkills).where(eq(customSkills.characterId, input.id)),
        db.select().from(customStatus).where(eq(customStatus.characterId, input.id)),
        db.select().from(experiencePacks).where(eq(experiencePacks.characterId, input.id)),
      ]);

      return {
        ...char[0],
        skills,
        background: background[0] ?? null,
        weapons: weaponsList,
        equipment: equipList,
        companions: companionsList,
        customSkills: customSkillList,
        customStatus: statusList,
        experiencePacks: packsList,
      };
    }),

  /**
   * 创建角色卡
   */
  create: publicQuery
    .input(
      z.object({
        name: z.string().min(1).max(100),
        playerId: z.number().optional(),
        campaignId: z.number().optional(),
        description: z.string().optional(),
        occupation: z.string().optional(),
        occupationCode: z.string().optional(),
        age: z.number().optional(),
        gender: z.string().optional(),
        era: z.string().optional(),
        residence: z.string().optional(),
        birthplace: z.string().optional(),
        portraitUrl: z.string().optional(),
        str: z.number().min(1).max(99).default(50),
        con: z.number().min(1).max(99).default(50),
        siz: z.number().min(1).max(99).default(50),
        dex: z.number().min(1).max(99).default(50),
        app: z.number().min(1).max(99).default(50),
        int: z.number().min(1).max(99).default(50),
        pow: z.number().min(1).max(99).default(50),
        edu: z.number().min(1).max(99).default(50),
        luck: z.number().min(1).max(99).default(50),
        // 可手动指定衍生属性，否则自动计算
        hp: z.number().optional(),
        mp: z.number().optional(),
        san: z.number().optional(),
        mov: z.number().optional(),
        build: z.number().optional(),
        db: z.string().optional(),
        skills: z
          .array(
            z.object({
              skillName: z.string(),
              baseValue: z.number().default(0),
              occupationPoints: z.number().default(0),
              interestPoints: z.number().default(0),
              isOccupation: z.boolean().default(false),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // 计算衍生属性
      const derived = calculateDerived(
        input.str,
        input.con,
        input.siz,
        input.dex,
        input.pow
      );

      // 创建角色卡
      const result = await db.insert(characters).values({
        name: input.name,
        playerId: input.playerId,
        campaignId: input.campaignId,
        description: input.description,
        occupation: input.occupation,
        occupationCode: input.occupationCode,
        age: input.age,
        gender: input.gender,
        era: input.era,
        residence: input.residence,
        birthplace: input.birthplace,
        portraitUrl: input.portraitUrl,
        str: input.str,
        con: input.con,
        siz: input.siz,
        dex: input.dex,
        app: input.app,
        int: input.int,
        pow: input.pow,
        edu: input.edu,
        luck: input.luck,
        hp: input.hp ?? derived.hp,
        maxHp: input.hp ?? derived.maxHp,
        mp: input.mp ?? derived.mp,
        maxMp: input.mp ?? derived.maxMp,
        san: input.san ?? derived.san,
        maxSan: 99,
        mov: input.mov ?? derived.mov,
        build: input.build ?? derived.build,
        db: input.db ?? derived.db,
      });

      const charId = Number(result[0].insertId);

      // 插入技能
      if (input.skills && input.skills.length > 0) {
        const skillValues = input.skills.map((s) => ({
          characterId: charId,
          skillName: s.skillName,
          baseValue: s.baseValue,
          occupationPoints: s.occupationPoints,
          interestPoints: s.interestPoints,
          finalValue: s.baseValue + s.occupationPoints + s.interestPoints,
          isOccupation: s.isOccupation,
        }));
        await db.insert(characterSkills).values(skillValues);
      }

      return { success: true, id: charId, message: `角色卡 "${input.name}" 创建成功` };
    }),

  /**
   * 更新角色卡基础信息
   */
  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        occupation: z.string().optional(),
        age: z.number().optional(),
        gender: z.string().optional(),
        str: z.number().min(1).max(99).optional(),
        con: z.number().min(1).max(99).optional(),
        siz: z.number().min(1).max(99).optional(),
        dex: z.number().min(1).max(99).optional(),
        app: z.number().min(1).max(99).optional(),
        int: z.number().min(1).max(99).optional(),
        pow: z.number().min(1).max(99).optional(),
        edu: z.number().min(1).max(99).optional(),
        luck: z.number().min(1).max(99).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      // 过滤掉undefined值
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      await db.update(characters).set(updateData).where(eq(characters.id, id));

      return { success: true, message: "角色卡更新成功" };
    }),

  /**
   * 删除角色卡
   */
  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(characterSkills).where(eq(characterSkills.characterId, input.id));
      await db.delete(characters).where(eq(characters.id, input.id));
      return { success: true, message: "角色卡已删除" };
    }),

  /**
   * 从文本导入角色卡 (.st 格式)
   * 支持: .st 力量40敏捷70意志45...
   */
  importFromText: publicQuery
    .input(
      z.object({
        text: z.string(),
        name: z.string(), // 角色名称
        playerId: z.number().optional(),
        campaignId: z.number().optional(),
        overwriteId: z.number().optional(), // 如果指定，则覆盖现有角色卡
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { attributes, skills, parsed, failed } = parseAttributesText(input.text);

      if (parsed.length === 0) {
        return {
          success: false,
          message: "未能从文本中解析出任何属性或技能",
          parsed,
          failed,
        };
      }

      // 收集基础属性
      const baseAttrs: Record<string, number> = {
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        luck: 50,
      };

      // 用解析到的值覆盖
      for (const [key, value] of Object.entries(attributes)) {
        if (key in baseAttrs) {
          baseAttrs[key] = Math.max(1, Math.min(99, value));
        }
      }

      // 计算衍生属性
      const derived = calculateDerived(
        baseAttrs.str,
        baseAttrs.con,
        baseAttrs.siz,
        baseAttrs.dex,
        baseAttrs.pow
      );

      // 检查是否覆盖
      let charId: number;
      if (input.overwriteId) {
        // 更新现有角色卡
        await db
          .update(characters)
          .set({
            ...baseAttrs,
            hp: attributes["hp"] ?? derived.hp,
            maxHp: derived.maxHp,
            mp: attributes["mp"] ?? derived.mp,
            maxMp: derived.maxMp,
            san: attributes["san"] ?? derived.san,
            maxSan: 99,
            mov: derived.mov,
            build: derived.build,
            db: derived.db,
            updatedAt: new Date(),
          })
          .where(eq(characters.id, input.overwriteId));

        charId = input.overwriteId;

        // 删除旧技能，插入新技能
        await db.delete(characterSkills).where(eq(characterSkills.characterId, charId));
      } else {
        // 创建新角色卡
        const result = await db.insert(characters).values({
          name: input.name,
          playerId: input.playerId,
          campaignId: input.campaignId,
          ...baseAttrs,
          hp: attributes["hp"] ?? derived.hp,
          maxHp: derived.maxHp,
          mp: attributes["mp"] ?? derived.mp,
          maxMp: derived.maxMp,
          san: attributes["san"] ?? derived.san,
          maxSan: 99,
          mov: derived.mov,
          build: derived.build,
          db: derived.db,
        });

        charId = Number(result[0].insertId);
      }

      // 插入技能
      if (Object.keys(skills).length > 0) {
        const skillValues = Object.entries(skills).map(([skillName, value]) => {
          const stdSkill = STANDARD_SKILLS[skillName];
          const baseValue = stdSkill?.baseValue ?? 0;
          return {
            characterId: charId,
            skillName,
            baseValue,
            occupationPoints: 0,
            interestPoints: Math.max(0, value - baseValue),
            finalValue: value,
            isOccupation: false,
          };
        });
        await db.insert(characterSkills).values(skillValues);
      }

      return {
        success: true,
        id: charId,
        message: `角色卡 "${input.name}" ${input.overwriteId ? "更新" : "录入"}完成，本次录入了${parsed.length}条数据`,
        parsed,
        failed,
      };
    }),

  /**
   * 修改角色属性值（HP、SAN、MP等）
   * .st hp-2, .st san+1d6
   */
  modifyAttribute: publicQuery
    .input(
      z.object({
        id: z.number(),
        attribute: z.string(), // hp, san, mp, str 等
        operation: z.enum(["set", "add", "sub"]),
        value: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // 标准化属性名
      const attrMap: Record<string, string> = {
        str: "str",
        力量: "str",
        con: "con",
        体质: "con",
        siz: "siz",
        体型: "siz",
        dex: "dex",
        敏捷: "dex",
        app: "app",
        外貌: "app",
        int: "intelligence",
        智力: "intelligence",
        pow: "pow",
        意志: "pow",
        edu: "edu",
        教育: "edu",
        luck: "luck",
        幸运: "luck",
        hp: "hp",
        体力: "hp",
        mp: "mp",
        魔法: "mp",
        san: "san",
        理智: "san",
        理智值: "san",
        mov: "mov",
        移动力: "mov",
      };

      const dbField = attrMap[input.attribute.toLowerCase()];
      if (!dbField) {
        return {
          success: false,
          message: `未知属性: "${input.attribute}"，支持的属性: str/con/siz/dex/app/int/pow/edu/luck/hp/mp/san/mov`,
        };
      }

      // 获取当前值
      const char = await db
        .select()
        .from(characters)
        .where(eq(characters.id, input.id))
        .limit(1);

      if (char.length === 0) {
        return { success: false, message: "未找到角色卡" };
      }

      const character = char[0];
      const currentValue = character[dbField as keyof typeof character] as number;

      let newValue: number;
      switch (input.operation) {
        case "set":
          newValue = input.value;
          break;
        case "add":
          newValue = currentValue + input.value;
          break;
        case "sub":
          newValue = currentValue - input.value;
          break;
      }

      // 限制范围
      newValue = Math.max(0, newValue);

      // 不能超过最大值（HP/MP/SAN）
      const maxField = dbField === "hp" ? "maxHp" : dbField === "mp" ? "maxMp" : dbField === "san" ? "maxSan" : null;
      if (maxField) {
        const maxValue = character[maxField as keyof typeof character] as number;
        newValue = Math.min(maxValue, newValue);
      }

      const updateData: Record<string, unknown> = {};
      updateData[dbField] = newValue;

      await db.update(characters).set(updateData).where(eq(characters.id, input.id));

      return {
        success: true,
        attribute: input.attribute,
        previousValue: currentValue,
        newValue,
        message: `${character.name} 的${input.attribute}: ${currentValue} → ${newValue}`,
      };
    }),

  /**
   * 添加/更新技能
   */
  upsertSkill: publicQuery
    .input(
      z.object({
        characterId: z.number(),
        skillName: z.string(),
        baseValue: z.number().optional(),
        occupationPoints: z.number().optional(),
        interestPoints: z.number().optional(),
        isOccupation: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { characterId, ...skillData } = input;

      // 查找现有技能
      const existing = await db
        .select()
        .from(characterSkills)
        .where(
          and(
            eq(characterSkills.characterId, characterId),
            eq(characterSkills.skillName, skillData.skillName)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // 更新
        const base = skillData.baseValue ?? existing[0].baseValue;
        const occ = skillData.occupationPoints ?? existing[0].occupationPoints;
        const interest = skillData.interestPoints ?? existing[0].interestPoints;

        await db
          .update(characterSkills)
          .set({
            ...skillData,
            finalValue: base + occ + interest,
          })
          .where(eq(characterSkills.id, existing[0].id));

        return { success: true, message: `技能 "${skillData.skillName}" 已更新` };
      } else {
        // 创建
        const stdSkill = STANDARD_SKILLS[skillData.skillName];
        const base = skillData.baseValue ?? stdSkill?.baseValue ?? 0;
        const occ = skillData.occupationPoints ?? 0;
        const interest = skillData.interestPoints ?? 0;

        await db.insert(characterSkills).values({
          characterId,
          skillName: skillData.skillName,
          baseValue: base,
          occupationPoints: occ,
          interestPoints: interest,
          finalValue: base + occ + interest,
          isOccupation: skillData.isOccupation ?? false,
        });

        return { success: true, message: `技能 "${skillData.skillName}" 已添加` };
      }
    }),

  /**
   * 删除技能
   */
  deleteSkill: publicQuery
    .input(z.object({ skillId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(characterSkills).where(eq(characterSkills.id, input.skillId));
      return { success: true, message: "技能已删除" };
    }),
});
