"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const TRUST_ITEMS = [
  "TechVision Ltd",
  "EuroLogistics SA",
  "NovaSoft GmbH",
  "PanAsia Corp",
  "HelvetiPharma",
  "AlpineBank AG",
];

export default function TrustBanner() {
  const t = useTranslations("landing.trust");

  return (
    <section className="py-12 bg-white dark:bg-[#0A1628] border-b border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          className="text-center text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {t("title")}
        </motion.p>

        {/* Scrolling logos marquee */}
        <div className="relative">
          <div className="flex items-center justify-center gap-12 flex-wrap">
            {TRUST_ITEMS.map((name, i) => (
              <motion.div
                key={name}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-50 dark:bg-[#111827] border border-gray-100 dark:border-gray-800"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{
                    backgroundColor: i % 2 === 0 ? "#00BFFF" : "#6A1B9A",
                    opacity: 0.8,
                  }}
                >
                  {name.charAt(0)}
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {name}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
