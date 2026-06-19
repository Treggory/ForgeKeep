import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Painter's-workbench palette
        gun:    "#14171C", // base background (gunmetal)
        panel:  "#1B2027", // raised surface
        panel2: "#222a33",
        line:   "#2A323C", // hairline borders
        ink:    "#E8E2D2", // parchment text
        muted:  "#8A93A0",
        jade:   "#3FB58F", // action + "owned" (from Pro Acryl Jade)
        brass:  "#C9A24B", // metallic accent / headings
        amber:  "#E0913A", // "already owned" warning
        rust:   "#B5503B", // destructive
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        body:    ["var(--font-body)", "ui-sans-serif", "system-ui"],
        mono:    ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: { panel: "0 1px 0 0 rgba(255,255,255,0.03), 0 8px 24px -12px rgba(0,0,0,0.6)" },
    },
  },
  plugins: [],
};
export default config;
