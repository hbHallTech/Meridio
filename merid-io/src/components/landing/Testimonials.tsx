"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const TESTIMONIALS = [
  { key: "t1", initials: "SM", color: "#00BFFF" },
  { key: "t2", initials: "JP", color: "#6A1B9A" },
  { key: "t3", initials: "MS", color: "#00BFFF" },
  { key: "t4", initials: "DC", color: "#6A1B9A" },
] as const;

export default function Testimonials() {
  const t = useTranslations("landing.testimonials");

  return (
    <section
      id="testimonials"
      className="py-20 lg:py-28 bg-white dark:bg-[#0A1628]"
      aria-label="Testimonials"
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

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {TESTIMONIALS.map(({ key, initials, color }, i) => (
            <motion.div
              key={key}
              className="relative p-8 rounded-2xl bg-gray-50 dark:bg-[#111827] border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-shadow duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              {/* Quote icon */}
              <Quote
                className="absolute top-6 right-6 w-10 h-10 opacity-10"
                style={{ color }}
              />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, si) => (
                  <Star
                    key={si}
                    className="w-4 h-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              {/* Quote text */}
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 italic">
                &ldquo;{t(`${key}Quote`)}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <div>
                  <div className="font-semibold text-[#001F3F] dark:text-white">
                    {t(`${key}Name`)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t(`${key}Role`)} &middot; {t(`${key}Company`)}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
