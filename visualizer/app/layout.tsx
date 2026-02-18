import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Child Safety Benchmark",
  description:
    "Benchmark dashboard for evaluating child safety AI models — grooming detection, NSFW filtering, health risk, and stranger meeting detection.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <a href="/" className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="Predator Hunters"
                className="h-10 w-10 rounded-full"
              />
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Child Safety Benchmark
                </h1>
                <p className="text-sm text-muted-foreground">
                  Predator Hunters — AI Model Evaluation
                </p>
              </div>
            </a>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="text-primary hover:underline">
                Leaderboard
              </a>
              <a href="/compare" className="text-muted-foreground hover:text-primary hover:underline">
                Compare
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
