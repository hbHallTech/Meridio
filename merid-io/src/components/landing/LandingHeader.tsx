"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sun, Moon, Globe } from "lucide-react";
import { MeridioLogo } from "@/components/MeridioLogo";
import Link from "next/link";

const NAV_ITEMS = ["features", "whyMeridio", "testimonials", "pricing", "contact"] as const;

export default function LandingHeader() {
  const t = useTranslations("landing.nav");
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const switchLocale = () => {
    const current = document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || "en";
    const next = current === "en" ? "fr" : "en";
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    window.location.reload();
  };

  const currentLocale = typeof document !== "undefined"
    ? document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || "en"
    : "en";

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 dark:bg-[#0A1628]/95 backdrop-blur-md shadow-lg"
            : "bg-transparent"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-2 cursor-pointer"
              aria-label="Meridio Home"
            >
              <MeridioLogo
                height={32}
                textColor={scrolled ? (theme === "dark" ? "#ffffff" : "#001F3F") : "#ffffff"}
              />
            </button>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-8" aria-label="Main navigation">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item}
                  onClick={() => scrollTo(item)}
                  className={`text-sm font-medium transition-colors hover:text-[#00BFFF] ${
                    scrolled
                      ? "text-gray-700 dark:text-gray-300"
                      : "text-white/90 hover:text-white"
                  }`}
                >
                  {t(item)}
                </button>
              ))}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-3">
              {/* Language */}
              <button
                onClick={switchLocale}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  scrolled
                    ? "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    : "text-white/80 hover:text-white"
                }`}
                aria-label="Switch language"
              >
                <Globe className="w-4 h-4" />
                {mounted ? (currentLocale === "en" ? "FR" : "EN") : "FR"}
              </button>

              {/* Dark mode */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className={`p-2 rounded-lg transition-colors ${
                    scrolled
                      ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                  aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
                >
                  {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              )}

              {/* Login */}
              <Link
                href="/login"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  scrolled
                    ? "text-gray-700 hover:text-[#001F3F] dark:text-gray-300 dark:hover:text-white"
                    : "text-white/90 hover:text-white"
                }`}
              >
                {t("login")}
              </Link>

              {/* Sign Up */}
              <Link
                href="/signup"
                className="px-5 py-2.5 bg-[#00BFFF] hover:bg-[#00A3D9] text-white text-sm font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-[#00BFFF]/25"
              >
                {t("signUpFree")}
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 rounded-lg"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? t("closeMenu") : t("menu")}
            >
              {mobileOpen ? (
                <X className={`w-6 h-6 ${scrolled ? "text-gray-900 dark:text-white" : "text-white"}`} />
              ) : (
                <Menu className={`w-6 h-6 ${scrolled ? "text-gray-900 dark:text-white" : "text-white"}`} />
              )}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <motion.nav
              className="absolute top-0 right-0 w-72 h-full bg-white dark:bg-[#0A1628] shadow-2xl p-6 pt-20"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              aria-label="Mobile navigation"
            >
              <div className="flex flex-col gap-2">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item}
                    onClick={() => scrollTo(item)}
                    className="text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium transition-colors"
                  >
                    {t(item)}
                  </button>
                ))}
                <hr className="my-3 border-gray-200 dark:border-gray-700" />
                <div className="flex items-center gap-3 px-4 py-2">
                  <button
                    onClick={switchLocale}
                    className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <Globe className="w-4 h-4" />
                    {mounted ? (currentLocale === "en" ? "Français" : "English") : "Français"}
                  </button>
                  {mounted && (
                    <button
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <Link
                  href="/login"
                  className="mx-4 py-2.5 text-center text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {t("login")}
                </Link>
                <Link
                  href="/signup"
                  className="mx-4 py-2.5 text-center bg-[#00BFFF] hover:bg-[#00A3D9] text-white font-semibold rounded-lg transition-colors"
                >
                  {t("signUpFree")}
                </Link>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
