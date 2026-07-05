export interface Tokens {
  bg: string;
  panel: string;
  row: string;
  rowHover: string;
  border: string;
  text: string;
  subtext: string;
  mono: string;
  accent: string;
  accentSoft: string;
  pinAccent: string;
}

export function getTokens(isDark: boolean): Tokens {
  return isDark
    ? {
        bg: "#131316",
        panel: "#1A1A1F",
        row: "#1F1F26",
        rowHover: "#26262F",
        border: "#2A2A33",
        text: "#EDEDF0",
        subtext: "#8A8A93",
        mono: "#C7C7D1",
        accent: "#7C5CFC",
        accentSoft: "rgba(124,92,252,0.14)",
        pinAccent: "#F0B347",
      }
    : {
        bg: "#F5F5F7",
        panel: "#FFFFFF",
        row: "#FAFAFB",
        rowHover: "#F0F0F3",
        border: "#E4E4E9",
        text: "#1C1C21",
        subtext: "#6B6B76",
        mono: "#3A3A42",
        accent: "#7C5CFC",
        accentSoft: "rgba(124,92,252,0.10)",
        pinAccent: "#B9791A",
      };
}
