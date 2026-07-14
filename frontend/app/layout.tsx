import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading AI Platform",
  description: "News and technical bias dashboard for macro futures markets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
        style={
          {
            "--font-ui": 'Inter, "Segoe UI Variable", "Segoe UI", Arial, sans-serif',
            "--font-data": '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
          } as React.CSSProperties
        }
        >
          {children}
        </body>
    </html>
  );
}
