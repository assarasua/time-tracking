import type { Metadata } from "next";

import "@/app/globals.css";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = {
  title: "Time Tracking",
  description: "Single-company time tracking MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <main className="container pb-10 pt-4 md:pt-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </body>
    </html>
  );
}
