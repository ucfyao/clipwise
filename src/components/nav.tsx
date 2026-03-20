"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "上传" },
    { href: "/tasks", label: "任务" },
    { href: "/settings", label: "设置" },
  ];

  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <Link href="/" className="mr-8 text-lg font-bold">
        ClipWise
      </Link>
      <div className="flex gap-1">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
