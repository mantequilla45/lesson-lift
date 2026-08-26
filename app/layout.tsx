import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Geist_Mono,
  Lora,
  Playfair_Display,
  Inter,
  Archivo_Black,
} from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["200","300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Slideshow theme fonts — referenced by name in the slide renderers
// (`makeText` picks `theme.fonts.heading` / `theme.fonts.body` as the CSS
// font-family). Without these `next/font` imports the browser silently
// falls back to the same system serif/sans for every theme and theme
// switching has no visible font effect.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Jooma",
  description: "AI-powered tools built for teachers",
};

/* Without this, mobile browsers render at a ~980px virtual viewport and zoom
 * out — so every sm:/md:/lg: class in the app resolved to its DESKTOP branch on
 * a phone, and the whole product rendered as a shrunken desktop page rather
 * than a mobile one. This is what makes the breakpoints real.
 *
 * No maximumScale/userScalable: pinch-zoom is an accessibility requirement,
 * not a layout bug to suppress. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${bricolage.variable} ${geistMono.variable} ${lora.variable} ${playfair.variable} ${inter.variable} ${archivoBlack.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col" style={{ backgroundColor: "#F1EFE3" }} suppressHydrationWarning>
        <NextTopLoader color="#1a1a1a" showSpinner={false} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
