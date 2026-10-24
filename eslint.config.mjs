import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "public/**", "node_modules/**", "src/components/globe/glyphs.ts", "next-env.d.ts"] },
];

export default config;
