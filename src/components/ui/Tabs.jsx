import { useEffect, useState } from 'react'
const Tabs = ({ tabs, defaultTab = 0, onChange, className = '' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab)

  // Sync with parent's defaultTab prop when it changes
  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  // Scroll to top whenever activeTab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeTab])

  const handleTabChange = (index) => {
    setActiveTab(index)
    if (onChange) {
      onChange(index)
    }
  }

  return (
    <div className={className}>
      <div className="border-b border-gray-400">
        <style dangerouslySetInnerHTML={{__html: `\n          .hide-scrollbar::-webkit-scrollbar {\n            display: none;\n          }\n        `}} />
        <nav className="flex -mb-px overflow-x-auto hide-scrollbar" aria-label="Tabs" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => handleTabChange(index)}
              className={`
                px-4 py-3 text-sm md:px-6 md:text-base font-medium whitespace-nowrap
                border-b-2 transition-colors duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                ${
                  activeTab === index
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-400'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-6">
        {tabs[activeTab]?.content}
      </div>
    </div>
  )
}

export default Tabs

