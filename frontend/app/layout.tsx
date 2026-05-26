import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const ibmMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finance Ally",
  description: "AI-powered trading workstation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${ibmMono.variable} h-full`}>
      <body className="h-full overflow-hidden bg-bg text-text antialiased">
        {children}
      </body>
    </html>
  );
}
