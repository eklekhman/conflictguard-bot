import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConflictGuard",
  description: "Telegram bot for real-time chat conflict risk analysis and manager alerts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
