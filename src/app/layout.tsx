import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const inter = Inter({
  variable: "--font-sans",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
