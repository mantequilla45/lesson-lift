import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Manrope, Geist_Mono, Spectral, Karla } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Lesson Lift",
  description: "AI-powered tools built for teachers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${manrope.variable} ${geistMono.variable} ${spectral.variable} ${karla.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#fcf9f8]" suppressHydrationWarning>{children}</body>
    </html>
  );
}
