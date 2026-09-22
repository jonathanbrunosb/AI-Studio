import { baseVisualGuidelines, noTextGuideline, promptPresets, type PromptPresetId } from "./prompt-templates";

const textRequestPatterns = [
  /\b(escrit[oa]s?|escrevendo|escreva|dizeres|legenda|t[ií]tulo|subt[ií]tulo|frase|slogan|texto)\b/i,
  /\b(data|prazo|indicador|kpi|percentual|valor(es)?|r\$|balan[cç]o|dre)\b/i,
  /["“”«»][^"“”«»]{2,}["“”«»]/,
  /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/,
  /\b(with|saying|text|title|written)\b/i,
];

/** Indica se o prompt parece solicitar textos ou informações oficiais dentro da imagem. */
export function detectsTextRequest(prompt: string) {
  return textRequestPatterns.some((pattern) => pattern.test(prompt));
}

/** Monta o prompt final: descrição do usuário + diretriz do preset + padrões visuais + proibição de textos. */
export function buildFinalPrompt(userPrompt: string, presetId?: PromptPresetId | null) {
  const description = userPrompt.trim().replace(/\s+/g, " ");
  const parts = [description];
  if (presetId && promptPresets[presetId]) parts.push(promptPresets[presetId].guideline);
  parts.push(baseVisualGuidelines, noTextGuideline);
  return parts.join(". ");
}
