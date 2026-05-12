import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Order Trailer",
  description: "Binance Futures Price Notification System",
  manifest: "/manifest.json",
  appleWebApp: {
    title: "Order Trailer",
    statusBarStyle: "black-translucent",
    startupImage: ["/icon.png"],
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  }
};

import Navbar from "./Navbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <main className="p-4 max-w-5xl mx-auto">
          {children}
        </main>
        <Toaster position="bottom-right" toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }} />
      </body>
    </html>
  );
}
