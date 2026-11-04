import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spotify – Web Player: Music for everyone",
  description: "Spotify Web reconstruction built with Next.js, TypeScript, Tailwind CSS, and Web Audio API.",
  icons: {
    icon: "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black antialiased selection:bg-spotify-green selection:text-black">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
