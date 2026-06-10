import { useState } from "react";
import { Route, Switch, Link, useLocation } from "wouter";
import { LayoutDashboard, List, ShoppingCart, BarChart3, Bot, Menu, X, Sun, Moon, TrendingUp } from "lucide-react";
import { Button } from "./components/ui/button";
import PortfolioView from "./views/PortfolioView";
import WatchlistView from "./views/WatchlistView";
import OrdersView from "./views/OrdersView";
import MarketDataView from "./views/MarketDataView";
import MrBotView from "./views/MrBotView";

export default function App() {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const navItems = [
    { id: "portfolio", label: "Portfolio", path: "/", icon: LayoutDashboard },
    { id: "watchlist", label: "Watchlist", path: "/watchlist", icon: List },
    { id: "orders", label: "Orders", path: "/orders", icon: ShoppingCart },
    { id: "market-data", label: "Market Data", path: "/market-data", icon: BarChart3 },
    { id: "mr-bot", label: "MR.BOT", path: "/mr-bot", icon: Bot },
  ];

  const getActiveTab = () => {
    if (location === "/") return "portfolio";
    return location.replace("/", "") || "portfolio";
  };

  const activeTab = getActiveTab();

  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${darkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-white dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-2 font-bold text-xl text-blue-600 dark:text-blue-400">
          <TrendingUp className="h-6 w-6" /> STOCKVAULT
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-white dark:bg-slate-900 border-r dark:border-slate-800 transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex flex-col h-full">
          <div className="hidden md:flex items-center gap-2 p-6 font-bold text-xl text-blue-600 dark:text-blue-400 border-b dark:border-slate-800">
            <TrendingUp className="h-6 w-6" /> STOCKVAULT
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <Link key={item.id} href={item.path} onClick={() => setSidebarOpen(false)}>
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-blue-600 text-white dark:bg-blue-500" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
                  >
                    <Icon className="h-5 w-5" /> {item.label}
                  </button>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t dark:border-slate-800">
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => { setDarkMode(!darkMode); document.documentElement.classList.toggle("dark"); }}>
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {darkMode ? "Light Mode" : "Dark Mode"}
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="hidden md:flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800">
          <h1 className="text-lg font-semibold capitalize">{activeTab.replace("-", " ")}</h1>
          <div className="flex items-center gap-4">
            <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Paper Trading
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Switch>
            <Route path="/" component={PortfolioView} />
            <Route path="/watchlist" component={WatchlistView} />
            <Route path="/orders" component={OrdersView} />
            <Route path="/market-data" component={MarketDataView} />
            <Route path="/mr-bot" component={MrBotView} />
            <Route>
              <div className="text-center py-10">
                <h2 className="text-2xl font-bold">404 - Page Not Found</h2>
              </div>
            </Route>
          </Switch>
        </div>
      </main>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}
