import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";

const Icon = {
  Dashboard: () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Projects:  () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  Activities:() => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  Budget:    () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Users:     () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Lookups:   () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
  Profile:   () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Analysis:  () => <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Chevron:   ({ open }: { open: boolean }) => <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>,
};

type SubItem = { name: string; path: string };
type NavItem = { name: string; icon: React.ReactNode; path?: string; subItems?: SubItem[] };

const NAV: NavItem[] = [
  { name: "Dashboard",  icon: <Icon.Dashboard />,  path: "/" },
  { name: "Analysis",   icon: <Icon.Analysis />,   path: "/analysis" },
  { name: "Projects",   icon: <Icon.Projects />,   subItems: [{ name: "All Projects", path: "/projects" }, { name: "New Project", path: "/projects/new" }] },
  { name: "Activities", icon: <Icon.Activities />, path: "/activities" },
  { name: "Budget",     icon: <Icon.Budget />,     subItems: [{ name: "Revisions", path: "/budget/revisions" }] },
  { name: "Users",      icon: <Icon.Users />,      path: "/users" },
  { name: "Lookups",    icon: <Icon.Lookups />,    path: "/lookups" },
  { name: "Profile",    icon: <Icon.Profile />,    path: "/profile" },
];

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const [openItems, setOpenItems] = useState<string[]>([]);

  const show         = isExpanded || isHovered || isMobileOpen;
  const isActive     = (path?: string) => !!path && location.pathname === path;
  const isSubActive  = (s: SubItem)    => location.pathname === s.path || location.pathname.startsWith(s.path + "/");
  const isGroupActive= (item: NavItem) => item.subItems?.some(isSubActive) ?? false;
  const toggle       = (name: string)  =>
    setOpenItems(p => p.includes(name) ? p.filter(n => n !== name) : [...p, name]);

  useEffect(() => {
    NAV.forEach(item => {
      if (item.subItems && isGroupActive(item) && !openItems.includes(item.name))
        setOpenItems(p => [...p, item.name]);
    });
  }, [location.pathname]);

  const linkCls = (active: boolean) =>
    `flex items-center rounded-lg transition-colors duration-150 cursor-pointer w-full
     ${show ? "gap-3 px-3 py-2" : "justify-center px-0 py-2.5"}
     ${active
       ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
       : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-800 dark:hover:text-white"}`;

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed top-0 left-0 h-screen z-50 flex flex-col
        bg-white dark:bg-gray-900
        border-r border-gray-200 dark:border-gray-800
        transition-all duration-300 ease-in-out
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"}
        ${show ? "w-[240px]" : "w-[68px]"}`}
    >
      {/* Logo */}
      <div className={`flex items-center flex-shrink-0 border-b border-gray-100 dark:border-gray-800
        ${show ? "gap-2.5 px-4 h-16" : "justify-center px-0 h-16"}`}>
        <img src="/logo-64.png" alt="TPFCS" className="w-9 h-9 object-contain flex-shrink-0" />
        {show && (
          <div className="min-w-0">
            <p className="text-[11.5px] font-bold text-gray-800 dark:text-white leading-tight">Tanzania Police Force</p>
            <p className="text-[10.5px] text-gray-500 dark:text-gray-400 leading-tight">Corporation Sole</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
        {NAV.map(item => (
          <div key={item.name}>
            {item.path ? (
              <Link to={item.path} title={!show ? item.name : undefined} className={linkCls(isActive(item.path))}>
                {item.icon}
                {show && <span className="text-[13px] font-medium">{item.name}</span>}
              </Link>
            ) : (
              <>
                <button onClick={() => toggle(item.name)} title={!show ? item.name : undefined} className={linkCls(isGroupActive(item))}>
                  {item.icon}
                  {show && (
                    <>
                      <span className="text-[13px] font-medium flex-1 text-left">{item.name}</span>
                      <Icon.Chevron open={openItems.includes(item.name)} />
                    </>
                  )}
                </button>
                {openItems.includes(item.name) && show && item.subItems && (
                  <div className="mt-0.5 ml-9 space-y-0.5">
                    {item.subItems.map(sub => (
                      <Link key={sub.name} to={sub.path}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px] transition-colors
                          ${isSubActive(sub)
                            ? "text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 font-medium"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60"}`}>
                        <span className="w-1 h-1 rounded-full bg-current opacity-50 flex-shrink-0" />
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

      {/* Bottom — only when expanded */}
      {show && (
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo-64.png" alt="TPFCS" className="w-7 h-7 object-contain flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 truncate">TPFCS</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">Project Management</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
