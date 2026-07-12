import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const GROWVAULT_CHATBOT_CONFIG_KEY = "growvault-chatbot";

export type GrowvaultChatbotConfig = {
  enabled: boolean;
  accountActionsEnabled: boolean;
};

const DEFAULT_CONFIG: GrowvaultChatbotConfig = {
  enabled: false,
  accountActionsEnabled: true,
};

function parsePayload(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { accountActionsEnabled: DEFAULT_CONFIG.accountActionsEnabled };
  }
  const payload = value as Record<string, unknown>;
  return { accountActionsEnabled: payload.accountActionsEnabled !== false };
}

export async function getGrowvaultChatbotConfig(): Promise<GrowvaultChatbotConfig> {
  let config = await prisma.growthConfig.findUnique({
    where: { key: GROWVAULT_CHATBOT_CONFIG_KEY },
  });
  if (!config) {
    try {
      config = await prisma.growthConfig.create({
        data: {
          key: GROWVAULT_CHATBOT_CONFIG_KEY,
          storefront: "GROW",
          enabled: false,
          payload: { accountActionsEnabled: true } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      config = await prisma.growthConfig.findUnique({
        where: { key: GROWVAULT_CHATBOT_CONFIG_KEY },
      });
    }
  }
  if (!config) throw new Error("GrowVault chatbot config could not be initialized");
  return { enabled: config.enabled, ...parsePayload(config.payload) };
}

export async function updateGrowvaultChatbotConfig(input: Partial<GrowvaultChatbotConfig>) {
  const current = await getGrowvaultChatbotConfig();
  const next: GrowvaultChatbotConfig = {
    enabled: input.enabled ?? current.enabled,
    accountActionsEnabled: input.accountActionsEnabled ?? current.accountActionsEnabled,
  };
  return prisma.growthConfig.update({
    where: { key: GROWVAULT_CHATBOT_CONFIG_KEY },
    data: {
      enabled: next.enabled,
      payload: { accountActionsEnabled: next.accountActionsEnabled } as Prisma.InputJsonValue,
    },
  });
}
