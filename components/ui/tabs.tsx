import * as React from 'react'

type TabsContextValue = {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within Tabs')
  }
  return context
}

export function Tabs({
  value,
  onValueChange,
  children,
}: {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '2px solid var(--admin-border)',
        marginBottom: 24,
      }}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const { value: selectedValue, onValueChange } = useTabsContext()
  const isActive = value === selectedValue

  return (
    <button
      onClick={() => onValueChange(value)}
      style={{
        padding: '12px 20px',
        background: 'transparent',
        border: 'none',
        borderBottom: isActive ? '2px solid var(--admin-primary)' : '2px solid transparent',
        color: isActive ? 'var(--admin-text)' : 'var(--admin-text-muted)',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: isActive ? 600 : 400,
        transition: 'all 0.2s',
        marginBottom: -2,
      }}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const { value: selectedValue } = useTabsContext()

  if (value !== selectedValue) {
    return null
  }

  return <div>{children}</div>
}
