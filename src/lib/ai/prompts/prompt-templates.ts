export type PromptPresetId = "comunicado" | "newsletter" | "sistemas" | "campanha";

export const promptPresets: Record<PromptPresetId, { label: string; guideline: string; example: string }> = {
  comunicado: {
    label: "Comunicado interno",
    guideline: "imagem corporativa minimalista, composição limpa com amplo espaço livre para inserção de texto",
    example: "Ambiente de escritório corporativo moderno e iluminado, mesa organizada com documentos e notebook, composição minimalista",
  },
  newsletter: {
    label: "Newsletter Contábil",
    guideline: "ilustração institucional relacionada ao tema da notícia, estilo editorial profissional",
    example: "Ilustração editorial sobre planejamento financeiro, gráficos abstratos e calculadora estilizada, estilo flat",
  },
  sistemas: {
    label: "Divulgação de sistemas",
    guideline: "ambiente tecnológico, interfaces ilustrativas abstratas e elementos digitais, sem telas legíveis",
    example: "Ambiente tecnológico com painéis digitais abstratos, fluxos de dados luminosos e elementos de automação",
  },
  campanha: {
    label: "Campanha interna",
    guideline: "composição visual institucional, inspiradora e acolhedora, voltada à comunicação com colaboradores",
    example: "Equipe diversa colaborando em ambiente corporativo, clima positivo, composição institucional",
  },
};

/** Diretrizes visuais padronizadas acrescentadas a todo prompt enviado ao provedor. */
export const baseVisualGuidelines = "paleta com predominância de tons de azul corporativo, iluminação profissional, alta qualidade";
export const noTextGuideline = "sem textos, sem letras, sem números, sem logotipos, sem marcas d'água";
