"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Pricing() {
  const t = useTranslations("landing.pricing");

  const plans = [
    {
      name: t("free"),
      price: t("freePrice"),
      period: t("freePeriod"),
      description: t("freeDesc"),
      features: [t("freeF1"), t("freeF2"), t("freeF3"), t("freeF4"), t("freeF5")],
      cta: t("freeCta"),
      href: "/signup",
      highlighted: false,
    },
    {
      name: t("pro"),
      price: t("proPrice"),
      period: t("proPeriod"),
      description: t("proDesc"),
      features: [t("proF1"), t("proF2"), t("proF3"), t("proF4"), t("proF5"), t("proF6")],
      cta: t("proCta"),
      href: "/signup",
      highlighted: true,
      badge: t("popular"),
    },
    {
      name: t("enterprise"),
      price: t("enterprisePrice"),
      period: t("enterprisePeriod"),
      description: t("enterpriseDesc"),
      features: [
        t("enterpriseF1"),
        t("enterpriseF2"),
        t("enterpriseF3"),
        t("enterpriseF4"),
        t("enterpriseF5"),
        t("enterpriseF6"),
      ],
      cta: t("enterpriseCta"),
      href: "#contact",
      highlighted: false,
    },
  ];

  return (
    <section
      id="pricing"
      className="py-20 lg:py-28 bg-gray-50 dark:bg-[#111827]"
      aria-label="Pricing"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#001F3F] dark:text-white">
            {t("title")}
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              className={`relative rounded-2xl p-8 transition-all duration-300 ${
                plan.highlighted
                  ? "bg-[#001F3F] dark:bg-[#001F3F] text-white shadow-2xl shadow-[#001F3F]/20 scale-105 border-2 border-[#00BFFF]"
                  : "bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-700 hover:shadow-xl"
              }`}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              {/* Popular badge */}
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#00BFFF] text-white text-sm font-bold rounded-full shadow-lg">
                  {plan.badge}
                </div>
              )}

              {/* Plan name */}
              <h3
                className={`text-xl font-bold mb-2 ${
                  plan.highlighted ? "text-white" : "text-[#001F3F] dark:text-white"
                }`}
              >
                {plan.name}
              </h3>

              {/* Price */}
              <div className="mb-1">
                <span
                  className={`text-4xl font-extrabold ${
                    plan.highlighted ? "text-[#00BFFF]" : "text-[#001F3F] dark:text-white"
                  }`}
                >
                  {plan.price}
                </span>
              </div>
              <p
                className={`text-sm mb-4 ${
                  plan.highlighted ? "text-white/60" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {plan.period}
              </p>

              {/* Description */}
              <p
                className={`text-sm mb-6 ${
                  plan.highlighted ? "text-white/80" : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {plan.description}
              </p>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check
                      className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        plan.highlighted ? "text-[#00BFFF]" : "text-emerald-500"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        plan.highlighted
                          ? "text-white/90"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.href}
                className={`group flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
                  plan.highlighted
                    ? "bg-[#00BFFF] hover:bg-[#00A3D9] text-white hover:shadow-lg hover:shadow-[#00BFFF]/30"
                    : "bg-[#001F3F] dark:bg-[#00BFFF] hover:bg-[#002855] dark:hover:bg-[#00A3D9] text-white"
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
