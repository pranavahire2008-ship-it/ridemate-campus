import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { ToastProvider } from "@/components/ui";
import { BottomNav, Navbar } from "@/components/nav";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://ridematecampus.com"),
  title: {
    default: "RideMate Campus — Student Carpooling Made Safer",
    template: "%s | RideMate Campus",
  },
  description:
    "Find students travelling on the same route and share rides safely between your home and college. Verified students, transparent routes, daily carpooling.",
  applicationName: "RideMate Campus",
  keywords: ["student carpool", "college rides", "campus transport", "safe carpooling", "India"],
  authors: [{ name: "RideMate Campus" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "RideMate Campus",
    title: "RideMate Campus — Student Carpooling Made Safer",
    description: "Share everyday college rides with verified students on your route.",
  },
  twitter: {
    card: "summary",
    title: "RideMate Campus — Student Carpooling Made Safer",
    description: "Share everyday college rides with verified students on your route.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#2451e6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white text-slate-900 antialiased" suppressHydrationWarning>
        <SessionProvider>
          <ToastProvider>
            <div className="flex min-h-dvh flex-col">
              <Navbar />
              <main className="flex-1 pb-24 lg:pb-0">{children}</main>
              <footer className="hidden border-t border-slate-100 bg-slate-50 py-10 lg:block">
                <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-extrabold tracking-tight text-slate-900">
                      Ride<span className="text-brand-600">Mate</span> Campus
                    </p>
                    <p className="mt-1 max-w-md text-sm text-slate-500">
                      Safe daily carpooling between home and college — built for verified students.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
                    <Link href="/privacy" className="hover:text-brand-600 transition">Privacy Policy</Link>
                    <Link href="/terms" className="hover:text-brand-600 transition">Terms</Link>
                    <Link href="/community-guidelines" className="hover:text-brand-600 transition">Community Guidelines</Link>
                    <Link href="/safety" className="hover:text-brand-600 transition">Safety</Link>
                  </div>
                </div>
              </footer>
              <BottomNav />
            </div>
          </ToastProvider>
        </SessionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
