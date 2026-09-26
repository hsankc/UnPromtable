import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { HowSection } from "@/components/landing/HowSection";
import { ProofSection } from "@/components/landing/ProofSection";
import { ModelsSection } from "@/components/landing/ModelsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { ClosingSection } from "@/components/landing/ClosingSection";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <ProblemSection />
        <HowSection />
        <ProofSection />
        <ModelsSection />
        <PricingSection />
        <ClosingSection />
      </main>
      <SiteFooter />
    </>
  );
}
