/**
 * Oopz Bot Webhook 处理器
 * 接收Oopz消息，解析指令，调用对应功能
 * 
 * 支持指令:
 * .st/.set   - 录入/设置角色卡属性
 * .ra/.rc    - 技能/属性检定
 * .sc        - 理智检定
 * .r         - 通用骰子投掷
 * .rd        - 伤害投掷
 * .nn        - 修改角色名
 * .show/.卡  - 查看角色卡
 * .help      - 帮助信息
 */

import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { characters, characterSkills, players } from "@db/schema";
import { eq, and } from "drizzle-orm";
import {
  SKILL_NAME_MAP,
  ATTR_NAME_MAP,
  STANDARD_SKILLS,
  RESULT_LABELS,
} from "@contracts/coc";
import {
  rollDice,
  calculateCheckResult,
  getTargetByDifficulty,
} from "./dice";

// ===== Oopz API 工具函数 =====

/**
 * 发送消息到Oopz频道
 */
async function sendOopzMessage(
  channelId: string,
  content: string,
  token: string
) {
  try {
    const res = await fetch("https://api.oopz.cn/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel_id: channelId,
        content,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 修改用户在频道的昵称
 */
async function setUserNickname(
  channelId: string,
  userId: string,
  nickname: string,
  token: string
) {
  try {
    const res = await fetch(
      `https://api.oopz.cn/v1/channels/${channelId}/members/${userId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nickname }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ===== 指令解析工具 =====

/**
 * 解析 .st 格式的属性文本
 */
function parseStText(text: string): Array<{ name: string; value: number }> {
  const results: Array<{ name: string; value: number }> = [];
  const cleanText = text.replace(/^\.st\s*/i, "").replace(/^\.set\s*/i, "").trim();

  // 匹配 中文/英文名称 + 数字
  const regex = /([\u4e00-\u9fa5a-zA-Z_]+)\s*(\d+)/g;
  let match;

  while ((match = regex.exec(cleanText)) !== null) {
    const name = match[1].trim();
    const value = parseInt(match[2]);
    if (!isNaN(value)) {
      results.push({ name, value });
    }
  }

  return results;
}

/**
 * 获取玩家当前激活的角色卡
 */
async function getActiveCharacter(playerId: number) {
  const db = getDb();
  const chars = await db
    .select()
    .from(characters)
    .where(and(eq(characters.playerId, playerId), eq(characters.isActive, true)))
    .limit(1);

  return chars[0] ?? null;
}

// ===== tRPC Router =====

export const oopzRouter = createRouter({
  /**
   * Oopz Webhook 入口
   * 接收Oopz推送的消息事件
   */
  webhook: publicQuery
    .input(
      z.object({
        // Oopz webhook payload
        event: z.string(), // "message.created"
        data: z.object({
          id: z.string(),
          channel_id: z.string(),
          author: z.object({
            id: z.string(),
            username: z.string(),
          }),
          content: z.string(),
          timestamp: z.string().optional(),
        }),
        // Bot配置
        botToken: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { data: msg } = input;
      const content = msg.content.trim();
      const channelId = msg.channel_id;
      const oopzUserId = msg.author.id;
      const username = msg.author.username;

      // 忽略非指令消息
      if (!content.startsWith(".")) {
        return { handled: false };
      }

      const db = getDb();
      // 获取或创建玩家
      const existingPlayer = await db
        .select()
        .from(players)
        .where(eq(players.oopzUserId, oopzUserId))
        .limit(1);

      let playerId: number;
      if (existingPlayer.length === 0) {
        const result = await db.insert(players).values({
          oopzUserId,
          nickname: username,
          isGm: false,
        });
        playerId = Number(result[0].insertId);
      } else {
        playerId = existingPlayer[0].id;
        // 更新昵称
        if (existingPlayer[0].nickname !== username) {
          await db
            .update(players)
            .set({ nickname: username })
            .where(eq(players.id, playerId));
        }
      }

      // ===== 指令分发 =====

      // --- .help 帮助 ---
      if (content.startsWith(".help") || content === ".h") {
        return {
          handled: true,
          reply: `=== COC跑团助手 指令列表 ===
**.st/.set** 属性名数值 [...] — 录入角色卡属性
  例: .st 力量40敏捷70意志45
**.ra** 技能名 [难度] — 技能/属性检定
  难度: (无)=普通 h=困难 e=极难 +1/+2=奖励骰 -1/-2=惩罚骰
  例: .ra 侦查, .ra 敏捷 h, .ra 聆听 +1
**.sc** 成功损失/失败损失 — 理智检定
  例: .sc 1/1d6, .sc 0/1d6
**.r** 骰子表达式 — 通用投掷
  例: .r d100, .r 2d6+3, .r 3d8
**.rd** 伤害表达式 — 伤害投掷
  例: .rd 1d6, .rd 1d8+db
**.nn** 新名称 — 修改当前角色卡名称
  例: .nn 科尔·海耶斯
**.show/.卡** — 查看当前角色卡
**.st hp-2** / **.st san+1** — 修改属性值`,
        };
      }

      // --- .nn 修改角色名 ---
      if (content.startsWith(".nn ")) {
        const newName = content.slice(4).trim();
        const char = await getActiveCharacter(playerId);

        if (!char) {
          return { handled: true, reply: "你还没有激活的角色卡，先用 .st 录入属性" };
        }

        await db
          .update(characters)
          .set({ name: newName })
          .where(eq(characters.id, char.id));

        // 尝试修改Oopz昵称
        if (input.botToken) {
          await setUserNickname(channelId, oopzUserId, `${newName} SAN${char.san} HP${char.hp}/${char.maxHp} DEX${char.dex}`, input.botToken);
        }

        return {
          handled: true,
          reply: `角色名已修改为: ${newName}`,
        };
      }

      // --- .show / .卡 查看角色卡 ---
      if (content === ".show" || content === ".卡") {
        const char = await getActiveCharacter(playerId);
        if (!char) {
          return { handled: true, reply: "你还没有激活的角色卡" };
        }

        const skills = await db
          .select()
          .from(characterSkills)
          .where(eq(characterSkills.characterId, char.id));

        const skillStr = skills
          .sort((a, b) => b.finalValue - a.finalValue)
          .map((s) => `${s.skillName}${s.finalValue}`)
          .join(" ");

        return {
          handled: true,
          reply: `【${char.name}】\nSTR${char.str} CON${char.con} SIZ${char.siz} DEX${char.dex} APP${char.app} INT${char.int} POW${char.pow} EDU${char.edu} LUCK${char.luck}\nHP${char.hp}/${char.maxHp} MP${char.mp}/${char.maxMp} SAN${char.san}/${char.maxSan} MOV${char.mov} BUILD${char.build} DB${char.db}\n技能: ${skillStr || "(无)"}`,
        };
      }

      // --- .st / .set 录入属性 ---
      if (content.startsWith(".st ") || content.startsWith(".set ")) {
        const parsed = parseStText(content);
        if (parsed.length === 0) {
          return { handled: true, reply: "未能解析属性，格式: .st 力量40敏捷70" };
        }

        // 获取当前激活的角色卡
        let char = await getActiveCharacter(playerId);

        if (!char) {
          // 创建新角色卡
          const result = await db.insert(characters).values({
            name: username,
            playerId,
            isActive: true,
            str: 50,
            con: 50,
            siz: 50,
            dex: 50,
            app: 50,
            int: 50,
            pow: 50,
            edu: 50,
            luck: 50,
            hp: 10,
            maxHp: 10,
            mp: 10,
            maxMp: 10,
            san: 50,
            maxSan: 99,
            mov: 8,
            build: 0,
            db: "+0",
          });
          char = (await db
            .select()
            .from(characters)
            .where(eq(characters.id, Number(result[0].insertId)))
            .limit(1))[0];
        }

        if (!char) {
          return { handled: true, reply: "角色卡创建失败" };
        }

        // 解析并应用属性
        const attrUpdates: Record<string, number | string> = {};
        const skillUpdates: Array<{ name: string; value: number }> = [];
        const successList: string[] = [];
        const failedList: string[] = [];

        for (const item of parsed) {
          const name = item.name.toLowerCase();

          // 检查是否为属性
          const attrKey = Object.keys(ATTR_NAME_MAP).find(
            (k) => k.toLowerCase() === name
          );
          if (attrKey) {
            const attrName = ATTR_NAME_MAP[attrKey];
            const attrMap: Record<string, string> = {
              力量: "str", 体质: "con", 体型: "siz", 敏捷: "dex",
              外貌: "app", 智力: "intelligence", 意志: "pow", 教育: "edu",
              幸运: "luck", 体力: "hp", 魔法: "mp", 理智: "san", 移动力: "mov",
              体格: "build",
            };
            const field = attrMap[attrName];
            if (field) {
              attrUpdates[field] = Math.max(1, Math.min(99, item.value));
              successList.push(`${attrName}${item.value}`);
              continue;
            }
          }

          // 检查是否为技能
          const skillKey = Object.keys(SKILL_NAME_MAP).find(
            (k) => k.toLowerCase() === name
          );
          if (skillKey) {
            const skillName = SKILL_NAME_MAP[skillKey];
            skillUpdates.push({ name: skillName, value: item.value });
            successList.push(`${skillName}${item.value}`);
            continue;
          }

          // 尝试标准技能匹配
          const stdSkill = Object.entries(STANDARD_SKILLS).find(
            ([key]) => key.toLowerCase().includes(name) || name.includes(key.toLowerCase())
          );
          if (stdSkill) {
            skillUpdates.push({ name: stdSkill[0], value: item.value });
            successList.push(`${stdSkill[0]}${item.value}`);
            continue;
          }

          failedList.push(item.name);
        }

        // 更新属性
        if (Object.keys(attrUpdates).length > 0) {
          // 重新计算衍生属性 (类型断言：这些字段一定是 number)
          const finalStr = (attrUpdates["str"] ?? char.str) as number;
          const finalCon = (attrUpdates["con"] ?? char.con) as number;
          const finalSiz = (attrUpdates["siz"] ?? char.siz) as number;
          const finalDex = (attrUpdates["dex"] ?? char.dex) as number;
          const finalPow = (attrUpdates["pow"] ?? char.pow) as number;

          // HP = (CON+SIZ)/10, MP = POW/5, SAN = POW
          if (attrUpdates["con"] || attrUpdates["siz"]) {
            attrUpdates["maxHp"] = Math.floor((finalCon + finalSiz) / 10);
            attrUpdates["hp"] = attrUpdates["maxHp"] as number;
          }
          if (attrUpdates["pow"]) {
            attrUpdates["maxMp"] = Math.floor(finalPow / 5);
            attrUpdates["mp"] = attrUpdates["maxMp"] as number;
            if (!attrUpdates["san"]) {
              attrUpdates["san"] = finalPow;
            }
          }
          // MOV
          let mov = 8;
          if (finalStr + finalDex < finalSiz) mov = 7;
          if (finalStr + finalDex > finalSiz * 2) mov = 9;
          attrUpdates["mov"] = mov;

          // BUILD & DB
          const strSiz = finalStr + finalSiz;
          let build = 0;
          let dbStr = "+0";
          if (strSiz >= 164 && strSiz <= 204) { build = 1; dbStr = "+1d4"; }
          else if (strSiz >= 205 && strSiz <= 284) { build = 2; dbStr = "+1d6"; }
          else if (strSiz >= 285) { build = 3; dbStr = "+2d6"; }
          else if (strSiz <= 64) { build = -2; dbStr = "-2"; }
          else if (strSiz <= 84) { build = -1; dbStr = "-1"; }
          attrUpdates["build"] = build;
          attrUpdates["db"] = dbStr;

          await db
            .update(characters)
            .set({ ...attrUpdates, updatedAt: new Date() })
            .where(eq(characters.id, char.id));
        }

        // 更新技能
        for (const su of skillUpdates) {
          const existing = await db
            .select()
            .from(characterSkills)
            .where(
              and(
                eq(characterSkills.characterId, char.id),
                eq(characterSkills.skillName, su.name)
              )
            )
            .limit(1);

          const stdSkill = STANDARD_SKILLS[su.name];
          const baseValue = stdSkill?.baseValue ?? 0;

          if (existing.length > 0) {
            await db
              .update(characterSkills)
              .set({
                finalValue: su.value,
                interestPoints: Math.max(0, su.value - baseValue - existing[0].occupationPoints),
              })
              .where(eq(characterSkills.id, existing[0].id));
          } else {
            await db.insert(characterSkills).values({
              characterId: char.id,
              skillName: su.name,
              baseValue,
              occupationPoints: 0,
              interestPoints: Math.max(0, su.value - baseValue),
              finalValue: su.value,
              isOccupation: false,
            });
          }
        }

        // 刷新角色卡数据
        const updatedChar = (await db
          .select()
          .from(characters)
          .where(eq(characters.id, char.id))
          .limit(1))[0];

        // 更新Oopz昵称
        if (input.botToken && updatedChar) {
          await setUserNickname(
            channelId,
            oopzUserId,
            `${updatedChar.name} SAN${updatedChar.san} HP${updatedChar.hp}/${updatedChar.maxHp} DEX${updatedChar.dex}`,
            input.botToken
          );
        }

        return {
          handled: true,
          reply: `<${updatedChar?.name ?? username}>的COC7属性录入完成，本次录入了${successList.length}条数据${failedList.length > 0 ? `\n未识别: ${failedList.join(", ")}` : ""}`,
        };
      }

      // --- .ra / .rc 技能检定 ---
      if (content.startsWith(".ra ") || content.startsWith(".rc ")) {
        const args = content.slice(4).trim();
        const char = await getActiveCharacter(playerId);

        if (!char) {
          return { handled: true, reply: "你还没有激活的角色卡，先用 .st 录入属性" };
        }

        // 解析参数: 技能名 难度 奖励骰
        let targetName = args;
        let difficulty: "normal" | "hard" | "extreme" = "normal";
        let bonusDice = 0;

        // 检测难度后缀
        if (args.endsWith(" e") || args.endsWith(" E")) {
          difficulty = "extreme";
          targetName = args.slice(0, -2).trim();
        } else if (args.endsWith(" h") || args.endsWith(" H")) {
          difficulty = "hard";
          targetName = args.slice(0, -2).trim();
        }

        // 检测奖励/惩罚骰
        const bonusMatch = targetName.match(/\s+([+-]\d)$/);
        if (bonusMatch) {
          bonusDice = parseInt(bonusMatch[1]);
          targetName = targetName.slice(0, -bonusMatch[0].length).trim();
        }

        // 查找目标值
        let targetValue = 0;
        let resolvedName = targetName;

        // 标准化技能名
        const skillKey = Object.keys(SKILL_NAME_MAP).find(
          (k) => k.toLowerCase() === targetName.toLowerCase()
        );
        if (skillKey) {
          resolvedName = SKILL_NAME_MAP[skillKey];
        }

        // 检查是否为属性
        const attrKey = Object.keys(ATTR_NAME_MAP).find(
          (k) => k.toLowerCase() === targetName.toLowerCase()
        );
        if (attrKey) {
          const attrName = ATTR_NAME_MAP[attrKey];
          const attrMap: Record<string, keyof typeof char> = {
            力量: "str", 体质: "con", 体型: "siz", 敏捷: "dex",
            外貌: "app", 智力: "int", 意志: "pow", 教育: "edu", 幸运: "luck",
          };
          const field = attrMap[attrName];
          if (field) {
            targetValue = char[field] as number;
          }
          resolvedName = attrName;
        } else {
          // 检查角色技能
          const skill = await db
            .select()
            .from(characterSkills)
            .where(
              and(
                eq(characterSkills.characterId, char.id),
                eq(characterSkills.skillName, resolvedName)
              )
            )
            .limit(1);

          if (skill.length > 0) {
            targetValue = skill[0].finalValue;
          } else {
            // 检查标准技能基础值
            const stdSkill = STANDARD_SKILLS[resolvedName];
            if (stdSkill) {
              targetValue = stdSkill.baseValue;
              if (resolvedName === "闪避") targetValue = char.dex;
              if (resolvedName === "母语") targetValue = char.edu;
            } else {
              return {
                handled: true,
                reply: `未找到技能 "${targetName}"，请先使用 .st 录入`,
              };
            }
          }
        }

        // 计算有效目标值
        const effectiveTarget = getTargetByDifficulty(targetValue, difficulty);

        // 投掷
        const roll = rollDice(100);
        const result = calculateCheckResult(roll, effectiveTarget);

        // 记录历史
        await db.insert(rollHistory).values({
          rollType: "skill",
          characterId: char.id,
          campaignId: char.campaignId,
          playerId,
          targetName: resolvedName,
          targetValue: effectiveTarget,
          rollResult: roll,
          difficulty,
          result,
          bonusDice,
          details: `${resolvedName}检定 D100=${roll}/${effectiveTarget} [${RESULT_LABELS[result]}]`,
        });

        return {
          handled: true,
          reply: `${char.name}的"${resolvedName}"检定:\nD100=${roll}/${effectiveTarget} 【${RESULT_LABELS[result]}】${bonusDice !== 0 ? ` (${bonusDice > 0 ? "奖励" : "惩罚"}骰:${bonusDice})` : ""}`,
        };
      }

      // --- .sc 理智检定 ---
      if (content.startsWith(".sc ")) {
        const args = content.slice(4).trim();
        const char = await getActiveCharacter(playerId);

        if (!char) {
          return { handled: true, reply: "你还没有激活的角色卡" };
        }

        // 解析: 成功损失/失败损失
        const parts = args.split("/");
        if (parts.length !== 2) {
          return {
            handled: true,
            reply: "格式错误，正确格式: .sc 成功损失/失败损失\n例: .sc 1/1d6, .sc 0/1d6",
          };
        }

        const successLoss = parts[0].trim();
        const failureLoss = parts[1].trim();

        // 当前SAN
        const currentSan = char.san;

        // 理智检定 d100 <= SAN
        const roll = rollDice(100);
        const result = calculateCheckResult(roll, currentSan);
        const isSuccess = ["success", "hard_success", "extreme_success", "critical"].includes(result);

        // 计算损失
        const lossExpr = isSuccess ? successLoss : failureLoss;
        let sanLoss = 0;

        if (lossExpr !== "0" && lossExpr) {
          const match = lossExpr.match(/^(?:(\d+))?d(\d+)$/);
          if (match) {
            const count = parseInt(match[1] || "1");
            const sides = parseInt(match[2]);
            for (let i = 0; i < count; i++) {
              sanLoss += rollDice(sides);
            }
          } else if (!isNaN(parseInt(lossExpr))) {
            sanLoss = parseInt(lossExpr);
          }
        }

        const newSan = Math.max(0, currentSan - sanLoss);
        await db
          .update(characters)
          .set({ san: newSan })
          .where(eq(characters.id, char.id));

        // 记录历史
        await db.insert(rollHistory).values({
          rollType: "san_check",
          characterId: char.id,
          campaignId: char.campaignId,
          playerId,
          targetName: "理智",
          targetValue: currentSan,
          rollResult: roll,
          result,
          details: `理智检定 D100=${roll}/${currentSan} [${RESULT_LABELS[result]}], SAN损失${sanLoss}`,
        });

        return {
          handled: true,
          reply: `${char.name} 的理智检定: D100=${roll}/${currentSan} 【${RESULT_LABELS[result]}】\nSAN损失: ${sanLoss}, 当前SAN: ${newSan}/${char.maxSan}`,
        };
      }

      // --- .r 通用骰子 ---
      if (content.startsWith(".r ")) {
        const expr = content.slice(3).trim().toLowerCase();
        const match = expr.match(/^(?:(\d+))?d(\d+)(?:([+-])(\d+))?$/);

        if (!match) {
          return {
            handled: true,
            reply: `无法解析骰子表达式: ${expr}\n格式: .r d100, .r 2d6+3`,
          };
        }

        const count = parseInt(match[1] || "1");
        const sides = parseInt(match[2]);
        const mod = parseInt(match[4] || "0") * (match[3] === "-" ? -1 : 1);

        const rolls: number[] = [];
        for (let i = 0; i < count; i++) {
          rolls.push(rollDice(sides));
        }
        const total = rolls.reduce((a, b) => a + b, 0) + mod;

        return {
          handled: true,
          reply: `${expr} = [${rolls.join(", ")}]${mod ? (mod > 0 ? `+${mod}` : mod) : ""} = ${total}`,
        };
      }

      // --- .rd 伤害骰 ---
      if (content.startsWith(".rd ")) {
        const expr = content.slice(4).trim().toLowerCase();
        const char = await getActiveCharacter(playerId);
        let dbBonus = 0;
        let cleanExpr = expr;

        if (expr.includes("db")) {
          cleanExpr = expr.replace("+db", "").replace("db", "");
          if (char) {
            const dbMatch = char.db.match(/([+-]?\d+)/);
            if (dbMatch) dbBonus = parseInt(dbMatch[1]);
          }
        }

        const match = cleanExpr.match(/^(?:(\d+))?d(\d+)(?:([+-])(\d+))?$/);
        if (!match) {
          return {
            handled: true,
            reply: `无法解析: ${expr}\n格式: .rd 1d6, .rd 1d8+db`,
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

        return {
          handled: true,
          reply: `伤害 ${expr} = [${rolls.join(", ")}]${mod ? (mod > 0 ? `+${mod}` : mod) : ""}${dbBonus ? `+DB(${dbBonus})` : ""} = ${total}`,
        };
      }

      // --- .st hp-2 / .st san+1 快捷修改 ---
      if (content.startsWith(".st ")) {
        const rest = content.slice(4).trim();
        // 匹配 hp-2, san+1, mp+3 等格式
        const modifyMatch = rest.match(/^([a-zA-Z\u4e00-\u9fa5]+)([+-])(\d+)$/);
        if (modifyMatch) {
          const attrName = modifyMatch[1];
          const op = modifyMatch[2];
          const val = parseInt(modifyMatch[3]);

          const char = await getActiveCharacter(playerId);
          if (!char) {
            return { handled: true, reply: "你还没有激活的角色卡" };
          }

          const attrMap: Record<string, string> = {
            str: "str", 力量: "str",
            con: "con", 体质: "con",
            siz: "siz", 体型: "siz",
            dex: "dex", 敏捷: "dex",
            app: "app", 外貌: "app",
            int: "intelligence", 智力: "intelligence", 灵感: "intelligence",
            pow: "pow", 意志: "pow",
            edu: "edu", 教育: "edu",
            luck: "luck", 幸运: "luck",
            hp: "hp", 体力: "hp", 生命: "hp",
            mp: "mp", 魔法: "mp",
            san: "san", 理智: "san", 理智值: "san", san值: "san",
            mov: "mov", 移动力: "mov",
          };

          const dbField = attrMap[attrName.toLowerCase()];
          if (!dbField) {
            return {
              handled: true,
              reply: `未知属性 "${attrName}"，支持的属性: hp/mp/san/str/con/siz/dex/app/int/pow/edu/luck`,
            };
          }

          const currentValue = char[dbField as keyof typeof char] as number;
          const newValue = op === "+"
            ? Math.min(
                dbField === "hp" ? char.maxHp : dbField === "mp" ? char.maxMp : dbField === "san" ? char.maxSan : 99,
                currentValue + val
              )
            : Math.max(0, currentValue - val);

          const updateData: Record<string, unknown> = {};
          updateData[dbField] = newValue;

          await db
            .update(characters)
            .set(updateData)
            .where(eq(characters.id, char.id));

          return {
            handled: true,
            reply: `${char.name} 的${attrName}: ${currentValue} → ${newValue}`,
          };
        }
      }

      // 未识别的指令
      return { handled: false };
    }),

  /**
   * 发送测试消息（用于验证Bot配置）
   */
  testMessage: publicQuery
    .input(
      z.object({
        channelId: z.string(),
        botToken: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const success = await sendOopzMessage(
        input.channelId,
        "🎲 COC跑团助手已连接！\n发送 .help 查看可用指令。",
        input.botToken
      );
      return { success, message: success ? "消息发送成功" : "消息发送失败" };
    }),
});

// 需要导入 rollHistory
import { rollHistory } from "@db/schema";
