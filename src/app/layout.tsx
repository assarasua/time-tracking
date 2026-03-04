import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Time Tracking",
  description: "Single-company time tracking MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
