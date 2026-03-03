"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import emailjs from "@emailjs/browser";

// Placeholder IDs - replace with your actual EmailJS credentials
const EMAILJS_SERVICE_ID = "service_meridio";
const EMAILJS_TEMPLATE_ID = "template_demo";
const EMAILJS_PUBLIC_KEY = "your_public_key";

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DemoModal({ open, onClose }: DemoModalProps) {
  const t = useTranslations("landing.demo");
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    employees: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;

    setStatus("sending");
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_name: form.name,
          from_email: form.email,
          company: form.company,
          employees: form.employees,
          message: form.message,
        },
        EMAILJS_PUBLIC_KEY
      );
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const handleClose = () => {
    onClose();
    // Reset after animation
    setTimeout(() => {
      setStatus("idle");
      setForm({ name: "", email: "", company: "", employees: "", message: "" });
    }, 300);
  };

  const employeeRanges = [
    t("range1"),
    t("range2"),
    t("range3"),
    t("range4"),
    t("range5"),
  ];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-lg bg-white dark:bg-[#1a1f2e] rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25 }}
          >
            {/* Header */}
            <div className="relative p-6 pb-0">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold text-[#001F3F] dark:text-white pr-10">
                {t("title")}
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t("subtitle")}
              </p>
            </div>

            {/* Body */}
            <div className="p-6">
              {status === "success" ? (
                <motion.div
                  className="text-center py-8"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                    {t("successTitle")}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">{t("successMessage")}</p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="demo-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {t("name")} *
                    </label>
                    <input
                      id="demo-name"
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="landing-input"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="demo-email"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {t("email")} *
                    </label>
                    <input
                      id="demo-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="landing-input"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="demo-company"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {t("company")}
                    </label>
                    <input
                      id="demo-company"
                      type="text"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      className="landing-input"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="demo-employees"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {t("employees")}
                    </label>
                    <select
                      id="demo-employees"
                      value={form.employees}
                      onChange={(e) => setForm({ ...form, employees: e.target.value })}
                      className="landing-input"
                    >
                      <option value="">{t("employeesPlaceholder")}</option>
                      {employeeRanges.map((range) => (
                        <option key={range} value={range}>
                          {range}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="demo-message"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {t("message")}
                    </label>
                    <textarea
                      id="demo-message"
                      rows={3}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="landing-input resize-none"
                    />
                  </div>

                  {status === "error" && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Something went wrong. Please try again.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full py-3.5 bg-[#00BFFF] hover:bg-[#00A3D9] disabled:opacity-60 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-[#00BFFF]/30"
                  >
                    {status === "sending" ? t("submitting") : t("submit")}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
