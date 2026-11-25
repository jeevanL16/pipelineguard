import React from "react";
import { Menu, Search, RefreshCw, Shield, ChevronRight } from "lucide-react";

export function Navbar({
  activePage,
  onOpenMobile = () => {},
  onOpenSearch = () => {},
  onRefresh = () => {},
  isRefreshing = false,
  backendStatus = "ok",
}) {
  return (
    <header className="h-16 px-4 md:px-6 bg-[#0e1320]/80 backdrop-blur-md border-b border-[#1e293b] flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile hamburger & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e293b]"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400 font-medium hidden sm:inline">PipelineGuard</span>
          <ChevronRight className="w-4 h-4 text-gray-600 hidden sm:inline" />
          <span className="text-white font-semibold">{activePage}</span>
        </div>
      </div>

      {/* Right: Search bar & Quick controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161f33] hover:bg-[#1e293b] border border-[#27354f] text-gray-400 hover:text-gray-200 text-xs transition"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search threats, pipelines...</span>
          <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-[#0e1320] text-gray-400 rounded border border-[#27354f]">
            Ctrl+K
          </kbd>
        </button>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh telemetry"
          className="p-2 rounded-lg bg-[#161f33] hover:bg-[#1e293b] border border-[#27354f] text-gray-400 hover:text-white transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
        </button>

        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#161f33] border border-[#27354f] text-xs">
          <div
            className={`w-2 h-2 rounded-full ${
              backendStatus === "ok" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span className="text-gray-300">Live Guard Active</span>
        </div>
      </div>
    </header>
  );
}
