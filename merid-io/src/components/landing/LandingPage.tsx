"use client";

import { useState } from "react";
import LandingHeader from "./LandingHeader";
import Hero from "./Hero";
import Features from "./Features";
import WhyMeridio from "./WhyMeridio";
import Testimonials from "./Testimonials";
import Pricing from "./Pricing";
import ContactSection from "./ContactSection";
import LandingFooter from "./LandingFooter";
import DemoModal from "./DemoModal";

export default function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <LandingHeader />
      <main>
        <Hero onDemoClick={() => setDemoOpen(true)} />
        <Features />
        <WhyMeridio />
        <Testimonials />
        <Pricing />
        <ContactSection />
      </main>
      <LandingFooter />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
