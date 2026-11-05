import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { ServiceWorkerRegister } from "@/components/player/ServiceWorkerRegister";
import { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#121212",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Spotify – Web Player: Music for everyone",
  description: "Spotify Web reconstruction built with Next.js, TypeScript, Tailwind CSS, and Web Audio API.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Spotify",
  },
  icons: {
    icon: "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png",
    apple: "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png",
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
        <ServiceWorkerRegister />
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}

