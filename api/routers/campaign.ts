/**
 * 战役/团管理 Router
 */

import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { campaigns, campaignPlayers, players } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const campaignRouter = createRouter({
  /**
   * 列出战役
   */
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }),

  /**
   * 获取战役详情
   */
  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const camp = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (camp.length === 0) return null;

      // 获取参与玩家
      const campPlayers = await db
        .select({
          campaignPlayerId: campaignPlayers.id,
          playerId: players.id,
          nickname: players.nickname,
          role: campaignPlayers.role,
          joinedAt: campaignPlayers.joinedAt,
        })
        .from(campaignPlayers)
        .innerJoin(players, eq(campaignPlayers.playerId, players.id))
        .where(eq(campaignPlayers.campaignId, input.id));

      return {
        ...camp[0],
        players: campPlayers,
      };
    }),

  /**
   * 创建战役
   */
  create: publicQuery
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        gmId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(campaigns).values({
        name: input.name,
        description: input.description,
        gmId: input.gmId,
        status: "preparing",
      });

      const campId = Number(result[0].insertId);

      // GM自动加入
      await db.insert(campaignPlayers).values({
        campaignId: campId,
        playerId: input.gmId,
        role: "gm",
      });

      return {
        success: true,
        id: campId,
        message: `战役 "${input.name}" 创建成功`,
      };
    }),

  /**
   * 更新战役
   */
  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        status: z.enum(["preparing", "running", "paused", "finished"]).optional(),
        currentScene: z.string().optional(),
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

      await db.update(campaigns).set(updateData).where(eq(campaigns.id, id));
      return { success: true, message: "战役已更新" };
    }),

  /**
   * 添加玩家到战役
   */
  addPlayer: publicQuery
    .input(
      z.object({
        campaignId: z.number(),
        playerId: z.number(),
        role: z.enum(["player", "observer"]).default("player"),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(campaignPlayers).values({
        campaignId: input.campaignId,
        playerId: input.playerId,
        role: input.role,
      });

      return { success: true, message: "玩家已加入战役" };
    }),
});
