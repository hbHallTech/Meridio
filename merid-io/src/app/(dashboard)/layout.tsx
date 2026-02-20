"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ToastProvider } from "@/components/ui/toast";
import { ChatAssistant } from "@/components/ChatAssistant";
import { IdleTimeoutModal } from "@/components/IdleTimeoutModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto p-6 bg-[#F5F7FA] dark:bg-[#0d1117]">
            {children}
          </main>
        </div>
      </div>
      <ChatAssistant />
      <IdleTimeoutModal />
    </ToastProvider>
  );
}
