import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    './src/components/settings/**/*.{js,ts,jsx,tsx}',
    './src/components/ui/**/*.{js,ts,jsx,tsx}',    
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config; 