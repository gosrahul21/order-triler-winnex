"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings } from "lucide-react";

const navLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/config", label: "Settings", icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="glass-panel m-4 p-3 flex justify-between items-center sticky top-4 z-50">
      <div className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 flex items-center gap-2">
        <span className="text-lg">📈</span> Order Trailer
      </div>
      <div className="flex items-center gap-1">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
