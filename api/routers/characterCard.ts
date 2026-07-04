/**
 * 角色卡附属数据 Router
 */

import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  characterBackgrounds,
  weapons,
  equipment,
  companions,
  customSkills,
  customStatus,
  experiencePacks,
} from "@db/schema";
import { eq } from "drizzle-orm";

// 通用工厂 - 武器
export const weaponRouter = createRouter({
  list: publicQuery.input(z.object({ characterId: z.number() })).query(async ({ input }) => {
    const db = getDb();
    return db.select().from(weapons).where(eq(weapons.characterId, input.characterId));
  }),
  create: publicQuery.input(z.object({
    characterId: z.number(),
    name: z.string(),
    damage: z.string().optional(),
    attacks: z.string().optional(),
    range: z.string().optional(),
    malfunction: z.number().optional(),
    ammoCapacity: z.number().optional(),
    currentAmmo: z.number().optional(),
    impale: z.boolean().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = getDb();
    const { characterId, ...data } = input;
    const result = await db.insert(weapons).values({ characterId, ...data });
    return { success: true, id: Number(result[0].insertId) };
  }),
  delete: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = getDb();
    await db.delete(weapons).where(eq(weapons.id, input.id));
    return { success: true };
  }),
});

// 装备
export const equipmentRouter = createRouter({
  list: publicQuery.input(z.object({ characterId: z.number() })).query(async ({ input }) => {
    const db = getDb();
    return db.select().from(equipment).where(eq(equipment.characterId, input.characterId));
  }),
  create: publicQuery.input(z.object({
    characterId: z.number(),
    name: z.string(),
    quantity: z.number().default(1),
    description: z.string().optional(),
    type: z.enum(["gear", "personal"]).default("gear"),
  })).mutation(async ({ input }) => {
    const db = getDb();
    const result = await db.insert(equipment).values(input);
    return { success: true, id: Number(result[0].insertId) };
  }),
  delete: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = getDb();
    await db.delete(equipment).where(eq(equipment.id, input.id));
    return { success: true };
  }),
});

// 同伴
export const companionRouter = createRouter({
  list: publicQuery.input(z.object({ characterId: z.number() })).query(async ({ input }) => {
    const db = getDb();
    return db.select().from(companions).where(eq(companions.characterId, input.characterId));
  }),
  create: publicQuery.input(z.object({
    characterId: z.number(),
    name: z.string(),
    relationship: z.string().optional(),
    description: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = getDb();
    const result = await db.insert(companions).values(input);
    return { success: true, id: Number(result[0].insertId) };
  }),
  delete: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = getDb();
    await db.delete(companions).where(eq(companions.id, input.id));
    return { success: true };
  }),
});

// 背景故事
export const backgroundRouter = createRouter({
  get: publicQuery.input(z.object({ characterId: z.number() })).query(async ({ input }) => {
    const db = getDb();
    const rows = await db.select().from(characterBackgrounds)
      .where(eq(characterBackgrounds.characterId, input.characterId)).limit(1);
    return rows[0] ?? null;
  }),
  upsert: publicQuery.input(z.object({
    characterId: z.number(),
    appearance: z.string().optional(),
    beliefs: z.string().optional(),
    significantPlaces: z.string().optional(),
    treasuredPossessions: z.string().optional(),
    traits: z.string().optional(),
    woundsAndScars: z.string().optional(),
    phobiasAndManias: z.string().optional(),
    tomesSpellsAndEncounters: z.string().optional(),
    extraStory: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = getDb();
    const { characterId, ...data } = input;
    const existing = await db.select().from(characterBackgrounds)
      .where(eq(characterBackgrounds.characterId, characterId)).limit(1);
    if (existing.length > 0) {
      await db.update(characterBackgrounds).set(data).where(eq(characterBackgrounds.id, existing[0].id));
      return { success: true, id: existing[0].id, action: "updated" };
    }
    const result = await db.insert(characterBackgrounds).values({ characterId, ...data });
    return { success: true, id: Number(result[0].insertId), action: "created" };
  }),
});

// 自定义技能
export const customSkillRouter = createRouter({
  list: publicQuery.input(z.object({ characterId: z.number() })).query(async ({ input }) => {
    const db = getDb();
    return db.select().from(customSkills).where(eq(customSkills.characterId, input.characterId));
  }),
  create: publicQuery.input(z.object({
    characterId: z.number(),
    category: z.enum(["art", "fighting", "firearm", "drive", "science"]),
    name: z.string(),
    baseValue: z.number().default(0),
  })).mutation(async ({ input }) => {
    const db = getDb();
    const result = await db.insert(customSkills).values(input);
    return { success: true, id: Number(result[0].insertId) };
  }),
  delete: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = getDb();
    await db.delete(customSkills).where(eq(customSkills.id, input.id));
    return { success: true };
  }),
});

// 自定义状态
export const customStatusRouter = createRouter({
  list: publicQuery.input(z.object({ characterId: z.number() })).query(async ({ input }) => {
    const db = getDb();
    return db.select().from(customStatus).where(eq(customStatus.characterId, input.characterId));
  }),
  create: publicQuery.input(z.object({
    characterId: z.number(),
    type: z.enum(["physical", "mental"]),
    name: z.string(),
    sanLoss: z.number().optional(),
    skillGrowth: z.string().optional(),
    description: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = getDb();
    const result = await db.insert(customStatus).values(input);
    return { success: true, id: Number(result[0].insertId) };
  }),
  delete: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = getDb();
    await db.delete(customStatus).where(eq(customStatus.id, input.id));
    return { success: true };
  }),
});

// 经历包
export const experiencePackRouter = createRouter({
  list: publicQuery.input(z.object({ characterId: z.number() })).query(async ({ input }) => {
    const db = getDb();
    return db.select().from(experiencePacks).where(eq(experiencePacks.characterId, input.characterId));
  }),
  create: publicQuery.input(z.object({
    characterId: z.number(),
    name: z.string(),
    description: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = getDb();
    const result = await db.insert(experiencePacks).values(input);
    return { success: true, id: Number(result[0].insertId) };
  }),
  delete: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = getDb();
    await db.delete(experiencePacks).where(eq(experiencePacks.id, input.id));
    return { success: true };
  }),
});
