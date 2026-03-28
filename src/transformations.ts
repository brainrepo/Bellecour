export interface Transformation {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

export const DEFAULT_TRANSFORMATIONS: Transformation[] = [
  {
    id: "grammar",
    label: "Grammar",
    icon: "spellcheck",
    prompt:
      "You are a precise copy editor. Fix all grammar, spelling, and punctuation errors in the user's text. " +
      "Keep the original meaning, tone, and style intact. Only return the corrected text, nothing else.",
  },
  {
    id: "formal",
    label: "Formal",
    icon: "briefcase",
    prompt:
      "You are a professional business writer. Rewrite the user's text in a formal, polished, professional tone " +
      "suitable for executive communication. Keep the same meaning. Only return the rewritten text, nothing else.",
  },
  {
    id: "funnier",
    label: "Fun",
    icon: "smile",
    prompt:
      "You are a witty writer. Rewrite the user's text to make it funnier and more entertaining while keeping " +
      "the core message. Add clever wordplay or humor where appropriate. Only return the rewritten text, nothing else.",
  },
  {
    id: "concise",
    label: "Concise",
    icon: "scissors",
    prompt:
      "You are a ruthless editor. Make the user's text as concise as possible — cut filler words, redundancy, " +
      "and unnecessary qualifiers. Every word must earn its place. Keep the meaning intact. " +
      "Only return the shortened text, nothing else.",
  },
  {
    id: "actions",
    label: "Actions",
    icon: "list-checks",
    prompt:
      "You are a project manager. Extract clear, actionable items from the user's text. " +
      "Format as a bullet list with each item starting with a verb. If there are no clear actions, " +
      "summarize the key takeaways as bullets instead. Only return the bullet list, nothing else.",
  },
  {
    id: "translate_it",
    label: "Italiano",
    icon: "IT",
    prompt:
      "Translate the user's text into Italian. Preserve the tone and meaning. " +
      "Only return the translated text, nothing else.",
  },
  {
    id: "translate_en",
    label: "English",
    icon: "EN",
    prompt:
      "Translate the user's text into English. Preserve the tone and meaning. " +
      "Only return the translated text, nothing else.",
  },
  {
    id: "translate_fr",
    label: "Français",
    icon: "FR",
    prompt:
      "Translate the user's text into French. Preserve the tone and meaning. " +
      "Only return the translated text, nothing else.",
  },
];

/** Icon names that map to Lucide components (used by RecordingOverlay) */
export const KNOWN_ICONS = [
  "spellcheck",
  "briefcase",
  "smile",
  "scissors",
  "list-checks",
  "type",
  "pen",
  "zap",
  "star",
  "heart",
  "globe",
  "message-square",
  "file-text",
  "coffee",
  "hash",
  "at-sign",
  "book",
  "wand",
  "layers",
  "target",
] as const;
