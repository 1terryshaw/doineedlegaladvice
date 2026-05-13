import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
    safelist: [
    "animate-fade-up",
    "stagger-1",
    "stagger-2",
    "stagger-3",
    "prose-link",
    // Location picker
    "bg-blue-50",
    "border-blue-200",
    "bg-blue-100",
    "text-blue-800",
    "text-blue-600",
    "text-blue-500",
    "hover:bg-blue-200",
    "rotate-180",
  ],
theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
