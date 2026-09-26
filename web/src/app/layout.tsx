import type { Metadata } from "next";
import { Figtree, Instrument_Sans, JetBrains_Mono, Unbounded } from "next/font/google";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { themeBootScript } from "@/lib/theme";
import "@/styles/krom.css";
import "@/styles/app.css";

// Krom faces for the whole site; Instrument Sans only for the logo lockup.
const display = Unbounded({ subsets: ["latin", "latin-ext"], variable: "--nf-display" });
const sans = Figtree({ subsets: ["latin", "latin-ext"], variable: "--nf-sans" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--nf-mono" });
const lockup = Instrument_Sans({ subsets: ["latin", "latin-ext"], variable: "--nf-lockup" });

export const metadata: Metadata = {
  title: { default: "Unpromptable", template: "%s | Unpromptable" },
  description:
    "AI ajanın parayı hiç tutmaz. Kontratın içindeki eğitilmiş model her ödemeye karar verir. Monad üzerinde.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      data-theme="light"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable} ${lockup.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
