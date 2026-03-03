import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Meridio - Intelligent HR Absence Management",
  description:
    "Automate 100% of the leave lifecycle. Reduce admin time by 80%, zero calculation errors, approval in less than 24h, 100% audit traceability. AI-powered document management, configurable workflows, multi-site support.",
  keywords:
    "HR software, leave management, absence management, AI HR, employee management, workflow automation, GDPR compliant, payroll, human resources, SaaS HR platform",
  openGraph: {
    title: "Meridio - Intelligent HR Absence Management",
    description:
      "Streamline HR: Automate Absences, Empower Teams. Reduce admin time by 80% with AI-powered leave management.",
    type: "website",
  },
};

export default function Home() {
  return <LandingPage />;
}
