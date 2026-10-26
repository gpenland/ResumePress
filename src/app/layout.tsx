import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Serif accent for page/card titles only — a small nod to the printed-resume
// feel the app is named after, without turning UI chrome (buttons, nav,
// labels, body copy) serif too. Wired up via --font-heading in globals.css.
const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ResumePress",
  description: "Build and manage your resume entries",
};

// Runs before paint to avoid a flash of the wrong theme: reads the stored
// preference (or falls back to the OS setting) and applies `.dark` to <html>
// before React hydrates. Must stay a plain inline script — anything that
// waits on React/useEffect runs after first paint.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

// A small hello for whoever opens devtools — purely decorative, kept out of
// THEME_INIT_SCRIPT so it never risks the flash-of-wrong-theme guarantee
// that script exists for.
const CONSOLE_GREETING_SCRIPT = `
console.log("%c\\ud83d\\udcc4 ResumePress", "font-size:16px;font-weight:bold;");
console.log("%cPoking around the source? Respect. May your next status update say \\"Offer.\\"", "color:#81A1C1;font-style:italic;");
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: CONSOLE_GREETING_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
