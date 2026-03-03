"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Send, CheckCircle2, AlertCircle, Mail, MapPin, Phone } from "lucide-react";
import emailjs from "@emailjs/browser";

// Placeholder IDs - replace with your actual EmailJS credentials
const EMAILJS_SERVICE_ID = "service_meridio";
const EMAILJS_TEMPLATE_ID = "template_contact";
const EMAILJS_PUBLIC_KEY = "your_public_key";

export default function ContactSection() {
  const t = useTranslations("landing.contact");
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t("required");
    if (!form.email.trim()) errs.email = t("required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t("invalidEmail");
    if (!form.message.trim()) errs.message = t("required");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus("sending");
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_name: form.name,
          from_email: form.email,
          company: form.company,
          message: form.message,
        },
        EMAILJS_PUBLIC_KEY
      );
      setStatus("success");
      setForm({ name: "", email: "", company: "", message: "" });
    } catch {
      setStatus("error");
    }
  };

  return (
    <section
      id="contact"
      className="py-20 lg:py-28 bg-white dark:bg-[#0A1628]"
      aria-label="Contact"
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

        <div className="grid lg:grid-cols-5 gap-12 max-w-5xl mx-auto">
          {/* Contact info */}
          <motion.div
            className="lg:col-span-2 space-y-8"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#00BFFF]/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-[#00BFFF]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#001F3F] dark:text-white">Email</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">contact@meridio.app</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#6A1B9A]/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-[#6A1B9A]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#001F3F] dark:text-white">Phone</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">+41 22 000 00 00</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#00BFFF]/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-[#00BFFF]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#001F3F] dark:text-white">Office</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Rue du Rhône 14<br />1204 Geneva, Switzerland
                </p>
              </div>
            </div>
          </motion.div>

          {/* Contact form */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {status === "success" ? (
              <motion.div
                className="p-8 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/30 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                  {t("successTitle")}
                </h3>
                <p className="text-emerald-600 dark:text-emerald-300">{t("successMessage")}</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Name */}
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                  >
                    {t("name")} *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t("namePlaceholder")}
                    className="landing-input"
                    aria-required="true"
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.name}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                  >
                    {t("email")} *
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={t("emailPlaceholder")}
                    className="landing-input"
                    aria-required="true"
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.email}
                    </p>
                  )}
                </div>

                {/* Company */}
                <div>
                  <label
                    htmlFor="contact-company"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                  >
                    {t("company")}
                  </label>
                  <input
                    id="contact-company"
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder={t("companyPlaceholder")}
                    className="landing-input"
                  />
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                  >
                    {t("message")} *
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder={t("messagePlaceholder")}
                    className="landing-input resize-none"
                    aria-required="true"
                    aria-invalid={!!errors.message}
                  />
                  {errors.message && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.message}
                    </p>
                  )}
                </div>

                {/* GDPR */}
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {t("gdprNotice")}
                </p>

                {/* Error message */}
                {status === "error" && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {t("errorMessage")}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="group flex items-center justify-center gap-2 w-full py-3.5 bg-[#00BFFF] hover:bg-[#00A3D9] disabled:opacity-60 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-[#00BFFF]/30"
                >
                  {status === "sending" ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t("sending")}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {t("send")}
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
