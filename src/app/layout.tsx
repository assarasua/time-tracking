import type { Metadata } from "next";

import "@/app/globals.css";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = {
  title: "Hutech HR Hub",
  description: "Manage employee time tracking, time off, monthly invoices, and quarterly goals in one place."
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
