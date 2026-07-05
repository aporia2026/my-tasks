import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Tasks",
  description: "Personal task dashboard with AI summaries of meetings and files",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          // Applies the stored manual theme before first paint to avoid a flash.
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("mt-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}',
          }}
        />
        {children}
      </body>
    </html>
  );
}
