import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GenForge — Live Career Agent",
  description: "A local, evidence-backed workspace for targeted resumes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {/* CONTRACT: THESIS quiet instrument panel | OWN-WORLD graphite rail + warm paper canvas | STORY facts -> proof -> target -> artifact | FIRST VIEWPORT orient, disclose, act | FORM persistent rail + task workspace + provenance inspector | FINISH calm confidence */}
        {children}
      </body>
    </html>
  );
}
