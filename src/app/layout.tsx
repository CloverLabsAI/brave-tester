import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Brave Tester",
  description: "Stealth integrity tester for Brave browser builds",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistMono.variable} font-mono antialiased min-h-screen`}>
        <header className="border-b border-[rgba(139,127,166,0.15)] bg-[#0d0919]/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400 text-lg">
                Brave Tester
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#8b7fa6]">
              <a href="https://github.com/CloverLabsAI/brave-tester" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
                GitHub
              </a>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-[rgba(139,127,166,0.15)] mt-16">
          <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-[#8b7fa6]">
            Brave Tester — Stealth verification for Brave browser builds
          </div>
        </footer>
      </body>
    </html>
  );
}
