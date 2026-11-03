import type { Metadata, Viewport } from "next";
import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Draftly — Polish your draft in seconds.",
    template: "%s · Draftly",
  },
  description:
    "Draftly 是面向中文用户的 AI 写作文件袋：润色、改写、翻译、语法、检测、风格画像与学术写作。",
  applicationName: "Draftly",
  keywords: [
    "AI 润色",
    "中文润色",
    "文本改写",
    "人性化改写",
    "学术写作",
    "Draftly",
  ],
  authors: [{ name: "一元硬币" }],
  openGraph: {
    title: "Draftly — Polish your draft in seconds.",
    description:
      "七种写作工具，装进一只文件袋。润色、改写、翻译、语法、检测、风格画像与学术写作。",
    type: "website",
    locale: "zh_CN",
    siteName: "Draftly",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#1a2030" },
  ],
  colorScheme: "light dark",
};

const themeScript = `
(function(){
  try {
    var key = "draftly-theme";
    var saved = localStorage.getItem(key);
    var theme = saved === "light" || saved === "dark"
      ? saved
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <LocaleProvider>
            <AnalyticsTracker />
            <AppShell>{children}</AppShell>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}