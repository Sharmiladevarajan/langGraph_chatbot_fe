import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LangGraph Document Chatbot",
  description: "Conversation + attachment-based chatbot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
