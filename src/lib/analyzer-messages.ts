export const EASTER_EGG_PROBABILITY = 0.08;

const NORMAL_ANALYZER_LOADING_MESSAGES = [
  "Analyse läuft...",
  "Bild wird geprüft...",
  "Pflanzenmerkmale werden erkannt...",
  "Mögliche Ursachen werden eingegrenzt...",
] as const;

const EASTER_EGG_ANALYZER_LOADING_MESSAGES = [
  "Analyse läuft... ich frage kurz die Blätter.",
  "Die Blätter flüstern erste Hinweise.",
] as const;

function pickMessage(
  messages: readonly string[],
  randomValue: number,
) {
  const index = Math.min(messages.length - 1, Math.floor(randomValue * messages.length));
  return messages[index] ?? NORMAL_ANALYZER_LOADING_MESSAGES[0];
}

export function getAnalyzerLoadingMessage({
  easterEggRoll = Math.random(),
  messageRoll = Math.random(),
}: {
  easterEggRoll?: number;
  messageRoll?: number;
} = {}) {
  return easterEggRoll < EASTER_EGG_PROBABILITY
    ? pickMessage(EASTER_EGG_ANALYZER_LOADING_MESSAGES, messageRoll)
    : pickMessage(NORMAL_ANALYZER_LOADING_MESSAGES, messageRoll);
}

