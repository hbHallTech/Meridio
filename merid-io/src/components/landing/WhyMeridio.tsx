"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { X, Check, ArrowRight } from "lucide-react";
import Link from "next/link";

const COMPARISON_KEYS = ["1", "2", "3", "4", "5"] as const;

export default function WhyMeridio() {
  const t = useTranslations("landing.whyMeridio");

  return (
    <section
      id="whyMeridio"
      className="py-20 lg:py-28 bg-gray-50 dark:bg-[#111827]"
      aria-label="Why Meridio"
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

        {/* Comparison */}
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {/* Desktop table header */}
          <div className="hidden md:grid md:grid-cols-2 gap-6 mb-6">
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-center">
              <h3 className="text-lg font-bold text-red-700 dark:text-red-400">
                {t("traditional")}
              </h3>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 text-center">
              <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {t("meridioEdge")}
              </h3>
            </div>
          </div>

          {/* Comparison rows */}
          <div className="space-y-4">
            {COMPARISON_KEYS.map((key, i) => (
              <motion.div
                key={key}
                className="grid md:grid-cols-2 gap-4 md:gap-6"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                {/* Traditional */}
                <div className="flex items-start gap-3 p-5 rounded-xl bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-700">
                  <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {t(`trad${key}`)}
                  </p>
                </div>

                {/* Meridio */}
                <div className="flex items-start gap-3 p-5 rounded-xl bg-white dark:bg-[#1a1f2e] border border-emerald-200 dark:border-emerald-900/30 shadow-sm">
                  <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed font-medium">
                    {t(`edge${key}`)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            className="mt-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 px-8 py-4 bg-[#00BFFF] hover:bg-[#00A3D9] text-white font-semibold text-lg rounded-xl transition-all hover:shadow-xl hover:shadow-[#00BFFF]/30 hover:-translate-y-0.5"
            >
              {t("cta")}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
