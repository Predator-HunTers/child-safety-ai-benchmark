"use client";

interface SuiteTabsProps {
  suites: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function SuiteTabs({ suites, activeTab, onTabChange }: SuiteTabsProps) {
  const tabs = ["Overview", ...suites.sort()];

  return (
    <div className="overflow-x-auto border-b">
      <nav className="flex gap-0" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
