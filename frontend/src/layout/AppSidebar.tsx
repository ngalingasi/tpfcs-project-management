import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  GridIcon, UserCircleIcon, TableIcon, ListIcon,
  ChevronDownIcon, HorizontaLDots,
} from "../icons";
import { useSidebar } from "../context/SidebarContext";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string }[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/",
  },
  {
    icon: <TableIcon />,
    name: "Projects",
    subItems: [
      { name: "All Projects",   path: "/projects" },
      { name: "New Project",    path: "/projects/new" },
    ],
  },
  {
    icon: <ListIcon />,
    name: "Activities",
    subItems: [
      { name: "All Activities", path: "/activities" },
      { name: "New Activity",   path: "/activities/new" },
    ],
  },
  {
    icon: <ChevronDownIcon />,
    name: "Budget",
    subItems: [
      { name: "Revisions",      path: "/budget/revisions" },
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "Users",
    subItems: [
      { name: "All Users",      path: "/users" },
    ],
  },
  {
    icon: <HorizontaLDots />,
    name: "Lookups",
    subItems: [
      { name: "Sectors",        path: "/lookups/sectors" },
      { name: "Regions",        path: "/lookups/regions" },
      { name: "Implementers",   path: "/lookups/implementers" },
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "Profile",
    path: "/profile",
  },
];

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const [openItems, setOpenItems] = useState<string[]>([]);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const isActive = (path?: string) => path && location.pathname === path;
  const isGroupActive = (item: NavItem) =>
    item.subItems?.some((s) => location.pathname.startsWith(s.path));

  const toggle = (name: string) => {
    setOpenItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const isOpen = (name: string) => openItems.includes(name);

  useEffect(() => {
    navItems.forEach((item) => {
      if (item.subItems && isGroupActive(item) && !openItems.includes(item.name)) {
        setOpenItems((prev) => [...prev, item.name]);
      }
    });
  }, [location.pathname]);

  const showText = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      ref={sidebarRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed top-0 left-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 transition-all duration-300 ${
        isMobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
      } ${showText ? "w-64" : "w-[72px]"}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-800">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
              stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {showText && (
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-white">TPFCS</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Project Mgmt</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-140px)]">
        {navItems.map((item) => (
          <div key={item.name}>
            {item.path ? (
              <Link
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive(item.path)
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white"
                }`}
              >
                <span className="flex-shrink-0 w-5 h-5">{item.icon}</span>
                {showText && <span className="text-sm font-medium">{item.name}</span>}
              </Link>
            ) : (
              <>
                <button
                  onClick={() => toggle(item.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isGroupActive(item)
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className="flex-shrink-0 w-5 h-5">{item.icon}</span>
                  {showText && (
                    <>
                      <span className="text-sm font-medium flex-1 text-left">{item.name}</span>
                      <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen(item.name) ? "rotate-180" : ""}`} />
                    </>
                  )}
                </button>
                {isOpen(item.name) && showText && item.subItems && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.subItems.map((sub) => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                          location.pathname === sub.path
                            ? "text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </nav>

      <SidebarWidget />
    </aside>
  );
}
