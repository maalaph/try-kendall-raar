import type { Metadata } from "next";
import { Inter, League_Spartan, Crimson_Pro } from "next/font/google";
import "./globals.css";
import { config } from "@/lib/config";
import Navbar from "@/components/Navbar";
import AnimatedBackground from "@/components/AnimatedBackground";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const leagueSpartan = League_Spartan({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-league-spartan",
});

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-crimson",
});

export const metadata: Metadata = {
  title: `${config.brand.name} - ${config.product.name} | ${config.product.type}`,
  description: config.positioning.core_pitch,
  keywords: [
    "AI receptionist",
    "24/7 receptionist",
    "appointment booking",
    "small business automation",
    ...config.target_market.ideal_clients,
  ].join(", "),
  viewport: {
    width: 1280,
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${leagueSpartan.variable} ${crimsonPro.variable} antialiased`}
        style={{ backgroundColor: config.brand.visual.palette.primary, color: config.brand.visual.palette.text }}
      >
        <AnimatedBackground />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
