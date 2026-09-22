export const designTokens = {
  colors: {
    brand: { 950: "#071a33", 900: "#0b2545", 800: "#123a63", 700: "#15558d", 600: "#1769aa", 100: "#dceeff", 50: "#f2f8ff" },
    surface: { canvas: "#f4f7fb", card: "#ffffff", subtle: "#f8fafc" },
    status: { draft: "#64748b", review: "#d97706", approved: "#1769aa", published: "#278563", changes: "#c75b64" },
  },
  typography: { sans: "Calibri, 'Segoe UI', Arial, sans-serif" },
  spacing: { page: "clamp(1rem, 2.4vw, 2rem)", section: "1.5rem" },
  borders: { default: "#e4eaf1" },
  shadows: { card: "0 8px 28px rgba(15, 39, 68, 0.07)" },
  radius: { sm: "10px", md: "14px", lg: "20px" },
} as const;
