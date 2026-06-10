"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Bot, FileText, Settings } from "lucide-react"

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/mr-bot", label: "MR.BOT", icon: Bot },
  { href: "/docs", label: "Alpaca CLI Docs", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1 p-4 border-r bg-card min-h-screen w-64">
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          STOCKVAULT
        </h1>
        <p className="text-xs text-muted-foreground">Algorithmic Trading</p>
      </div>
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive 
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
