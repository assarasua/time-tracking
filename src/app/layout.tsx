import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Time Tracking",
  description: "Single-company time tracking MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <main className="container py-6 md:py-10">{children}</main>
      </body>
    </html>
  );
}
