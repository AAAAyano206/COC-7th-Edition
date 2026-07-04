/**
 * COC 跑团助手 - 数据库关系定义
 */

import { relations } from "drizzle-orm";
import {
  players,
  campaigns,
  characters,
  characterSkills,
  rollHistory,
  sceneRules,
  campaignPlayers,
  characterBackgrounds,
  weapons,
  equipment,
  companions,
  customSkills,
  customStatus,
  experiencePacks,
} from "./schema";

export const playersRelations = relations(players, ({ many }) => ({
  characters: many(characters),
  campaignPlayers: many(campaignPlayers),
  rollHistory: many(rollHistory),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  gm: one(players, { fields: [campaigns.gmId], references: [players.id] }),
  characters: many(characters),
  sceneRules: many(sceneRules),
  campaignPlayers: many(campaignPlayers),
  rollHistory: many(rollHistory),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  player: one(players, { fields: [characters.playerId], references: [players.id] }),
  campaign: one(campaigns, { fields: [characters.campaignId], references: [campaigns.id] }),
  skills: many(characterSkills),
  rollHistory: many(rollHistory),
  background: one(characterBackgrounds),
  weapons: many(weapons),
  equipment: many(equipment),
  companions: many(companions),
  customSkills: many(customSkills),
  customStatus: many(customStatus),
  experiencePacks: many(experiencePacks),
}));

export const characterSkillsRelations = relations(characterSkills, ({ one }) => ({
  character: one(characters, { fields: [characterSkills.characterId], references: [characters.id] }),
}));

export const rollHistoryRelations = relations(rollHistory, ({ one }) => ({
  character: one(characters, { fields: [rollHistory.characterId], references: [characters.id] }),
  campaign: one(campaigns, { fields: [rollHistory.campaignId], references: [campaigns.id] }),
  player: one(players, { fields: [rollHistory.playerId], references: [players.id] }),
}));

export const sceneRulesRelations = relations(sceneRules, ({ one }) => ({
  campaign: one(campaigns, { fields: [sceneRules.campaignId], references: [campaigns.id] }),
}));

export const campaignPlayersRelations = relations(campaignPlayers, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignPlayers.campaignId], references: [campaigns.id] }),
  player: one(players, { fields: [campaignPlayers.playerId], references: [players.id] }),
}));

export const characterBackgroundsRelations = relations(characterBackgrounds, ({ one }) => ({
  character: one(characters, { fields: [characterBackgrounds.characterId], references: [characters.id] }),
}));

export const weaponsRelations = relations(weapons, ({ one }) => ({
  character: one(characters, { fields: [weapons.characterId], references: [characters.id] }),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  character: one(characters, { fields: [equipment.characterId], references: [characters.id] }),
}));

export const companionsRelations = relations(companions, ({ one }) => ({
  character: one(characters, { fields: [companions.characterId], references: [characters.id] }),
}));
