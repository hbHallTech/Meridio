import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meridio - Gestion des congés",
  description: "Application de gestion des congés et absences",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
