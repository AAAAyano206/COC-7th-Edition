/**
 * 玩家管理 Router
 */

import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { players } from "@db/schema";
import { eq } from "drizzle-orm";

export const playerRouter = createRouter({
  /**
   * 列出所有玩家
   */
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(players);
  }),

  /**
   * 根据ID获取玩家
   */
  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(players)
        .where(eq(players.id, input.id))
        .limit(1);
      return result[0] ?? null;
    }),

  /**
   * 根据Oopz ID获取或创建玩家
   */
  getOrCreate: publicQuery
    .input(
      z.object({
        oopzUserId: z.string(),
        nickname: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // 查找现有玩家
      const existing = await db
        .select()
        .from(players)
        .where(eq(players.oopzUserId, input.oopzUserId))
        .limit(1);

      if (existing.length > 0) {
        // 更新昵称
        await db
          .update(players)
          .set({ nickname: input.nickname })
          .where(eq(players.id, existing[0].id));

        return { ...existing[0], nickname: input.nickname, isNew: false };
      }

      // 创建新玩家
      const result = await db.insert(players).values({
        oopzUserId: input.oopzUserId,
        nickname: input.nickname,
        isGm: false,
      });

      return {
        id: Number(result[0].insertId),
        oopzUserId: input.oopzUserId,
        nickname: input.nickname,
        isGm: false,
        isNew: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

  /**
   * 更新玩家信息
   */
  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        nickname: z.string().optional(),
        isGm: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      const updateData: Record<string, unknown> = {};
      if (updates.nickname !== undefined) updateData.nickname = updates.nickname;
      if (updates.isGm !== undefined) updateData.isGm = updates.isGm;

      await db.update(players).set(updateData).where(eq(players.id, id));
      return { success: true, message: "玩家信息已更新" };
    }),
});
