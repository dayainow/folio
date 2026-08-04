import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Folio",
  description: "프로젝트의 기록 — 브라우저에 저장되는 개인 워크스페이스",
  applicationName: "Folio",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Folio",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

const themeInitScript = `(function(){try{if(localStorage.getItem('folio_theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

const localeInitScript = `(function(){try{var k='folio_locale';var v=localStorage.getItem(k);if(!v){var n=(navigator.language||'').toLowerCase();v=n.indexOf('ja')===0?'ja':n.indexOf('en')===0?'en':'ko';}if(v==='ko'||v==='en'||v==='ja'){document.documentElement.lang=v;document.cookie=k+'='+v+';path=/;max-age=31536000;SameSite=Lax';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
