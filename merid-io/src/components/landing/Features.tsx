"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  GitBranch,
  BarChart3,
  FileSearch,
  Building2,
  ShieldCheck,
} from "lucide-react";

const FEATURES = [
  { key: "leave", icon: CalendarCheck, color: "#00BFFF" },
  { key: "workflow", icon: GitBranch, color: "#6A1B9A" },
  { key: "dashboard", icon: BarChart3, color: "#00BFFF" },
  { key: "docAi", icon: FileSearch, color: "#6A1B9A" },
  { key: "multiSite", icon: Building2, color: "#00BFFF" },
  { key: "security", icon: ShieldCheck, color: "#6A1B9A" },
] as const;

export default function Features() {
  const t = useTranslations("landing.features");

  return (
    <section
      id="features"
      className="py-20 lg:py-28 bg-white dark:bg-[#0A1628]"
      aria-label="Features"
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

        {/* Feature cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map(({ key, icon: Icon, color }, i) => (
            <motion.div
              key={key}
              className="group relative p-8 rounded-2xl bg-gray-50 dark:bg-[#111827] border border-gray-100 dark:border-gray-800 hover:border-[#00BFFF]/30 dark:hover:border-[#00BFFF]/30 transition-all duration-300 hover:shadow-xl hover:shadow-[#00BFFF]/5 hover:-translate-y-1"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon className="w-7 h-7" style={{ color }} />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-[#001F3F] dark:text-white mb-3">
                {t(`${key}Title`)}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {t(`${key}Desc`)}
              </p>

              {/* Decorative corner gradient */}
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-tr-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at top right, ${color}10, transparent 70%)`,
                }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
