import type { Metadata } from "next";
import { Providers } from "./providers";
import { CustomCursor } from "@/components/CustomCursor";
import "./globals.css";

export const metadata: Metadata = {
  title: "Occult Markets — Encrypted Prediction Markets",
  description: "Finally, the price reflects what people actually believe. Not what they believe other traders believe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CustomCursor />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
