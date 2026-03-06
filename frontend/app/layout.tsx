import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

export const metadata = {
  title: "Workforce Pulse — Montgomery Dashboard",
  description:
    "Real-time workforce and economic intelligence for Montgomery, Alabama."
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-slate-950 text-slate-50 font-sans">
        {children}
      </body>
    </html>
  );
}

