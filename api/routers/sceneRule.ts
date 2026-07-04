/**
 * 特殊场景规则 Router
 * 用于定义战斗、追逐等特殊场景下的规则调整
 */

import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { sceneRules } from "@db/schema";
import { eq } from "drizzle-orm";

export const sceneRuleRouter = createRouter({
  /**
   * 列出场景规则
   */
  list: publicQuery
    .input(
      z.object({
        campaignId: z.number().optional(),
        activeOnly: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      let query = db.select().from(sceneRules);

      if (input.campaignId) {
        query = query.where(eq(sceneRules.campaignId, input.campaignId)) as typeof query;
      }

      if (input.activeOnly) {
        query = query.where(eq(sceneRules.isActive, true)) as typeof query;
      }

      return query;
    }),

  /**
   * 创建场景规则
   */
  create: publicQuery
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        affectedSkills: z.string().optional(), // JSON字符串或逗号分隔
        adjustType: z.enum(["bonus", "penalty", "multiplier", "auto_success", "auto_fail"]),
        adjustValue: z.number().default(0),
        campaignId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(sceneRules).values({
        name: input.name,
        description: input.description,
        affectedSkills: input.affectedSkills,
        adjustType: input.adjustType,
        adjustValue: input.adjustValue,
        campaignId: input.campaignId,
        isActive: true,
      });

      return {
        success: true,
        id: Number(result[0].insertId),
        message: `场景规则 "${input.name}" 已创建`,
      };
    }),

  /**
   * 更新场景规则
   */
  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        affectedSkills: z.string().optional(),
        adjustType: z.enum(["bonus", "penalty", "multiplier", "auto_success", "auto_fail"]).optional(),
        adjustValue: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      await db.update(sceneRules).set(updateData).where(eq(sceneRules.id, id));
      return { success: true, message: "场景规则已更新" };
    }),

  /**
   * 删除场景规则
   */
  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(sceneRules).where(eq(sceneRules.id, input.id));
      return { success: true, message: "场景规则已删除" };
    }),
});
