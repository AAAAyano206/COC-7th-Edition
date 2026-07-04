/**
 * 骰子投掷与检定系统 Router
 * 核心功能：骰子投掷、技能检定、理智检定、伤害投掷
 */

import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { characters, characterSkills, rollHistory } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  type CheckResult,
  type Difficulty,
  RESULT_LABELS,
  SKILL_NAME_MAP,
  ATTR_NAME_MAP,
  STANDARD_SKILLS,
} from "@contracts/coc";

// ===== 骰子工具函数 =====

/**
 * 投掷一个骰子
 * @param sides 骰子面数
 * @returns 1 到 sides 的随机整数
 */
export function rollDice(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * 投掷多个骰子并求和
 * @param count 骰子数量
 * @param sides 骰子面数
 * @returns 总和
 */
export function rollDiceSum(count: number, sides: number): number {
  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += rollDice(sides);
  }
  return sum;
}

/**
 * 计算 d100 的十位和个位
 * @param value 1-100 的值
 * @returns [十位, 个位]
 */
function getDigits(value: number): [number, number] {
  if (value === 100) return [0, 0];
  return [Math.floor(value / 10), value % 10];
}

/**
 * 计算检定结果
 * COC 7版规则：
 * - 掷出 1 = 大成功 (critical)
 * - 掷出 100 = 大失败 (fumble)
 * - 目标值 < 50 且掷出 96-100 = 大失败
 * - 目标值 >= 50 且掷出 100 = 大失败 (已包含)
 * - 掷出 <= 目标值/5 = 极难成功 (extreme_success)
 * - 掷出 <= 目标值/2 = 困难成功 (hard_success)
 * - 掷出 <= 目标值 = 成功 (success)
 * - 其他 = 失败 (failure)
 */
export function calculateCheckResult(
  roll: number,
  target: number
): CheckResult {
  // 大成功：掷出1
  if (roll === 1) return "critical";
  // 大失败：掷出100
  if (roll === 100) return "fumble";
  // 大失败：目标值<50时掷出96-100
  if (target < 50 && roll >= 96) return "fumble";
  // 极难成功：<= 目标值/5
  if (roll <= Math.floor(target / 5)) return "extreme_success";
  // 困难成功：<= 目标值/2
  if (roll <= Math.floor(target / 2)) return "hard_success";
  // 成功：<= 目标值
  if (roll <= target) return "success";
  // 失败
  return "failure";
}

/**
 * 带奖励/惩罚骰的检定
 * @param baseRoll 基础掷骰值
 * @param bonusDice 奖励骰数量 (+) / 惩罚骰数量 (-)
 * @returns 最终使用的十位数字
 */
export function applyBonusDice(baseRoll: number, bonusDice: number): {
  finalRoll: number;
  allRolls: number[];
  usedIndex: number;
} {
  const isBonus = bonusDice > 0;
  const diceCount = Math.abs(bonusDice);

  const [originalTens] = getDigits(baseRoll);
  const ones = baseRoll % 10;

  const allTens: number[] = [originalTens];
  for (let i = 0; i < diceCount; i++) {
    allTens.push(rollDice(10) - 1); // 0-9
  }

  // 奖励骰取最小的十位，惩罚骰取最大的十位
  const selectedTens = isBonus ? Math.min(...allTens) : Math.max(...allTens);
  const finalRoll = selectedTens * 10 + ones;
  const effectiveRoll = finalRoll === 0 ? 100 : finalRoll;

  return {
    finalRoll: effectiveRoll,
    allRolls: allTens,
    usedIndex: allTens.indexOf(selectedTens),
  };
}

/**
 * 计算最终目标值（考虑难度调整）
 */
export function getTargetByDifficulty(
  baseTarget: number,
  difficulty: Difficulty
): number {
  switch (difficulty) {
    case "extreme":
      return Math.floor(baseTarget / 5);
    case "hard":
      return Math.floor(baseTarget / 2);
    case "normal":
    default:
      return baseTarget;
  }
}

// ===== tRPC Router =====

export const diceRouter = createRouter({
  /**
   * 通用骰子投掷
   * 格式: .r 2d6+3, .r d100, .r 3d8
   */
  roll: publicQuery
    .input(
      z.object({
        expression: z.string(), // e.g. "2d6+3", "d100", "1d8"
        characterId: z.number().optional(),
        campaignId: z.number().optional(),
        playerId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const expr = input.expression.toLowerCase().replace(/\s/g, "");

      // 解析骰子表达式
      const match = expr.match(/^(?:(\d+))?d(\d+)(?:([+-])(\d+))?$/);
      if (!match) {
        return {
          success: false,
          message: `无法解析骰子表达式: ${input.expression}，格式如: 2d6+3, d100`,
        };
      }

      const count = parseInt(match[1] || "1");
      const sides = parseInt(match[2]);
      const modifierSign = match[3];
      const modifierValue = parseInt(match[4] || "0");
      const modifier =
        modifierSign === "-" ? -modifierValue : modifierValue;

      // 投掷
      const rolls: number[] = [];
      for (let i = 0; i < count; i++) {
        rolls.push(rollDice(sides));
      }
      const sum = rolls.reduce((a, b) => a + b, 0) + modifier;

      // 记录历史
      const db = getDb();
      if (input.characterId || input.campaignId) {
        await db.insert(rollHistory).values({
          rollType: "custom",
          characterId: input.characterId,
          campaignId: input.campaignId,
          playerId: input.playerId,
          rollResult: Math.max(1, sum),
          result: "success",
          details: `${input.expression} = [${rolls.join(", ")}]${
            modifier ? (modifier > 0 ? `+${modifier}` : modifier) : ""
          } = ${sum}`,
        });
      }

      return {
        success: true,
        expression: input.expression,
        rolls,
        modifier,
        total: sum,
        details: `${input.expression} = [${rolls.join(", ")}]${
          modifier ? (modifier > 0 ? `+${modifier}` : modifier) : ""
        } = ${sum}`,
      };
    }),

  /**
   * 技能/属性检定 (d100)
   * .ra 技能名 [难度] [奖励/惩罚]
   */
  skillCheck: publicQuery
    .input(
      z.object({
        characterId: z.number(),
        targetName: z.string(), // 技能名或属性名
        difficulty: z.enum(["normal", "hard", "extreme"]).default("normal"),
        bonusDice: z.number().min(-2).max(2).default(0), // 奖励/惩罚骰
        campaignId: z.number().optional(),
        playerId: z.number().optional(),
        sceneAdjust: z.number().default(0), // 场景调整值
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // 1. 获取角色卡
      const char = await db
        .select()
        .from(characters)
        .where(eq(characters.id, input.characterId))
        .limit(1);

      if (char.length === 0) {
        return { success: false, message: "未找到角色卡" };
      }
      const character = char[0];

      // 2. 确定目标值
      let targetValue = 0;
      let resolvedName = input.targetName;

      // 标准化输入名称
      const normalizedInput = input.targetName.trim();

      // 尝试作为属性匹配
      const attrKey = Object.keys(ATTR_NAME_MAP).find(
        (k) => k.toLowerCase() === normalizedInput.toLowerCase()
      );
      if (attrKey) {
        const attrName = ATTR_NAME_MAP[attrKey];
        const attrMap: Record<string, keyof typeof character> = {
          力量: "str",
          体质: "con",
          体型: "siz",
          敏捷: "dex",
          外貌: "app",
          智力: "int",
          意志: "pow",
          教育: "edu",
          幸运: "luck",
        };
        const dbField = attrMap[attrName];
        if (dbField) {
          targetValue = character[dbField] as number;
        }
        resolvedName = attrName;
      } else {
        // 尝试作为技能匹配
        const skillKey = Object.keys(SKILL_NAME_MAP).find(
          (k) => k.toLowerCase() === normalizedInput.toLowerCase()
        );
        if (skillKey) {
          resolvedName = SKILL_NAME_MAP[skillKey];
        }

        // 查询角色技能表
        const skill = await db
          .select()
          .from(characterSkills)
          .where(
            and(
              eq(characterSkills.characterId, input.characterId),
              eq(characterSkills.skillName, resolvedName)
            )
          )
          .limit(1);

        if (skill.length > 0) {
          targetValue = skill[0].finalValue;
        } else {
          // 检查是否为标准技能（使用基础值）
          const stdSkill = STANDARD_SKILLS[resolvedName];
          if (stdSkill) {
            targetValue = stdSkill.baseValue;
            // 特殊处理：闪避基础值 = DEX
            if (resolvedName === "闪避") {
              targetValue = character.dex;
            }
            // 特殊处理：母语 = EDU
            if (resolvedName === "母语") {
              targetValue = character.edu;
            }
          } else {
            return {
              success: false,
              message: `未找到技能或属性: "${input.targetName}"，请检查拼写或使用 .st 录入`,
            };
          }
        }
      }

      // 3. 应用场景调整
      targetValue += input.sceneAdjust;
      targetValue = Math.max(1, Math.min(99, targetValue)); // 限制在1-99

      // 4. 根据难度调整目标值
      const effectiveTarget = getTargetByDifficulty(targetValue, input.difficulty);

      // 5. 投掷 d100
      const baseRoll = rollDice(100);

      // 6. 应用奖励/惩罚骰
      let finalRoll = baseRoll;
      let bonusDetails = null;
      if (input.bonusDice !== 0) {
        const bonus = applyBonusDice(baseRoll, input.bonusDice);
        finalRoll = bonus.finalRoll;
        bonusDetails = bonus;
      }

      // 7. 计算结果
      const result = calculateCheckResult(finalRoll, effectiveTarget);

      // 8. 记录历史
      await db.insert(rollHistory).values({
        rollType: "skill",
        characterId: input.characterId,
        campaignId: input.campaignId || character.campaignId,
        playerId: input.playerId,
        targetName: resolvedName,
        targetValue: effectiveTarget,
        rollResult: finalRoll,
        difficulty: input.difficulty,
        result,
        bonusDice: input.bonusDice,
        details: `${resolvedName}检定 D100=${finalRoll}/${effectiveTarget} [${RESULT_LABELS[result]}]`,
      });

      // 9. 返回结果
      const diffLabel =
        input.difficulty === "hard"
          ? "困难"
          : input.difficulty === "extreme"
          ? "极难"
          : "";

      return {
        success: true,
        characterName: character.name,
        targetName: resolvedName,
        baseTarget: targetValue,
        difficulty: input.difficulty,
        effectiveTarget,
        baseRoll,
        finalRoll,
        bonusDice: input.bonusDice,
        bonusDetails,
        result,
        resultLabel: RESULT_LABELS[result],
        isSuccess: ["success", "hard_success", "extreme_success", "critical"].includes(result),
        message: `${character.name} 的${diffLabel}${resolvedName}检定: D100=${finalRoll}/${effectiveTarget} 【${RESULT_LABELS[result]}】`,
      };
    }),

  /**
   * 理智检定 (San Check)
   * .sc 成功损失/失败损失
   */
  sanCheck: publicQuery
    .input(
      z.object({
        characterId: z.number(),
        successLoss: z.string(), // e.g. "1d6", "0", "1"
        failureLoss: z.string(), // e.g. "1d6", "1d10", "2"
        sanCost: z.number().default(0), // 看到某物直接损失的SAN
        campaignId: z.number().optional(),
        playerId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // 获取角色卡
      const char = await db
        .select()
        .from(characters)
        .where(eq(characters.id, input.characterId))
        .limit(1);

      if (char.length === 0) {
        return { success: false, message: "未找到角色卡" };
      }
      const character = char[0];

      // 当前SAN值
      const currentSan = character.san;

      // 直接扣除SAN（如看到恐怖场景）
      if (input.sanCost > 0) {
        const newSan = Math.max(0, currentSan - input.sanCost);
        await db
          .update(characters)
          .set({ san: newSan })
          .where(eq(characters.id, input.characterId));
      }

      // 理智检定: d100 <= 当前SAN
      const roll = rollDice(100);
      const result = calculateCheckResult(roll, currentSan);
      const isSuccess = ["success", "hard_success", "extreme_success", "critical"].includes(result);

      // 计算SAN损失
      let sanLoss = 0;
      const lossExpr = isSuccess ? input.successLoss : input.failureLoss;

      if (lossExpr !== "0" && lossExpr) {
        const match = lossExpr.match(/^(?:(\d+))?d(\d+)(?:([+-])(\d+))?$/);
        if (match) {
          const count = parseInt(match[1] || "1");
          const sides = parseInt(match[2]);
          const mod = parseInt(match[4] || "0") * (match[3] === "-" ? -1 : 1);
          sanLoss = rollDiceSum(count, sides) + mod;
        } else if (!isNaN(parseInt(lossExpr))) {
          sanLoss = parseInt(lossExpr);
        }
      }

      sanLoss = Math.max(0, sanLoss);
      const newSan = Math.max(0, currentSan - input.sanCost - sanLoss);

      // 更新角色SAN值
      await db
        .update(characters)
        .set({ san: newSan })
        .where(eq(characters.id, input.characterId));

      // 记录历史
      await db.insert(rollHistory).values({
        rollType: "san_check",
        characterId: input.characterId,
        campaignId: input.campaignId || character.campaignId,
        playerId: input.playerId,
        targetName: "理智",
        targetValue: currentSan,
        rollResult: roll,
        result,
        details: `理智检定 D100=${roll}/${currentSan} [${RESULT_LABELS[result]}], SAN损失${sanLoss}, 当前SAN:${newSan}`,
      });

      return {
        success: true,
        characterName: character.name,
        roll,
        currentSan,
        result,
        resultLabel: RESULT_LABELS[result],
        isSuccess,
        sanLoss,
        sanCost: input.sanCost,
        newSan,
        message: `${character.name} 的理智检定: D100=${roll}/${currentSan} 【${RESULT_LABELS[result]}】\nSAN损失: ${input.sanCost > 0 ? `${input.sanCost}(场景)+` : ""}${sanLoss}, 当前SAN: ${newSan}/${character.maxSan}`,
      };
    }),

  /**
   * 伤害投掷
   * .rd 表达式
   */
  damageRoll: publicQuery
    .input(
      z.object({
        expression: z.string(), // e.g. "1d6", "2d6+db", "1d8+2"
        characterId: z.number().optional(),
        campaignId: z.number().optional(),
        playerId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const expr = input.expression.toLowerCase().replace(/\s/g, "");

      // 简单解析: 1d6, 2d6+3, 1d8+db
      let dbBonus = 0;
      let expression = expr;

      if (expr.includes("db") || expr.includes("+db")) {
        expression = expr.replace("+db", "").replace("db", "");
        // 从角色卡获取DB（简化处理）
        if (input.characterId) {
          const db = getDb();
          const char = await db
            .select()
            .from(characters)
            .where(eq(characters.id, input.characterId))
            .limit(1);
          if (char.length > 0) {
            const dbStr = char[0].db;
            const dbMatch = dbStr.match(/([+-]?\d+)/);
            if (dbMatch) dbBonus = parseInt(dbMatch[1]);
          }
        }
      }

      // 解析骰子
      const match = expression.match(/^(?:(\d+))?d(\d+)(?:([+-])(\d+))?$/);
      if (!match) {
        return {
          success: false,
          message: `无法解析伤害表达式: ${input.expression}`,
        };
      }

      const count = parseInt(match[1] || "1");
      const sides = parseInt(match[2]);
      const mod = parseInt(match[4] || "0") * (match[3] === "-" ? -1 : 1);

      const rolls: number[] = [];
      for (let i = 0; i < count; i++) {
        rolls.push(rollDice(sides));
      }
      const total = rolls.reduce((a, b) => a + b, 0) + mod + dbBonus;

      // 记录历史
      if (input.characterId) {
        const db = getDb();
        await db.insert(rollHistory).values({
          rollType: "damage",
          characterId: input.characterId,
          campaignId: input.campaignId,
          playerId: input.playerId,
          rollResult: Math.max(1, total),
          result: "success",
          details: `伤害 ${input.expression} = [${rolls.join(", ")}]${
            mod ? (mod > 0 ? `+${mod}` : mod) : ""
          }${dbBonus ? `+DB(${dbBonus})` : ""} = ${total}`,
        });
      }

      return {
        success: true,
        expression: input.expression,
        rolls,
        modifier: mod,
        dbBonus,
        total: Math.max(1, total),
        details: `${input.expression} = [${rolls.join(", ")}]${
          mod ? (mod > 0 ? `+${mod}` : mod) : ""
        }${dbBonus ? `+DB(${dbBonus})` : ""} = ${Math.max(1, total)}`,
      };
    }),

  /**
   * 获取检定历史
   */
  getHistory: publicQuery
    .input(
      z.object({
        characterId: z.number().optional(),
        campaignId: z.number().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      let query = db
        .select()
        .from(rollHistory)
        .orderBy(desc(rollHistory.createdAt))
        .limit(input.limit);

      if (input.characterId) {
        query = query.where(eq(rollHistory.characterId, input.characterId)) as typeof query;
      }
      if (input.campaignId) {
        query = query.where(eq(rollHistory.campaignId, input.campaignId)) as typeof query;
      }

      return query;
    }),
});
