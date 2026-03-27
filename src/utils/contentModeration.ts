const BANNED_WORDS = [
  "nude",
  "nudes",
  "sex",
  "sexy",
  "fuck",
  "bitch",
  "asshole",
  "slut",
  "rape",
  "rapist",
  "kill yourself",
  "idiot",
  "whore",
  "porn",
  "dick",
  "pussy",
  "fag",
  "niga",
  "nigga",
  "nigger",
];

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const containsObjectionableContent = (text?: string | null) => {
  if (!text) return false;

  const normalized = normalizeText(text);

  return BANNED_WORDS.some((word) => normalized.includes(word));
};

export const validateSafeText = (
  text: string | undefined | null,
  fieldName = "content",
) => {
  if (containsObjectionableContent(text)) {
    return {
      valid: false,
      message: `Your ${fieldName} contains language or content that is not allowed on LoveMap.`,
    };
  }

  return { valid: true, message: "" };
};