import type { ReactNode } from 'react'

const paths = {
  sessions: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19c0-3 2.7-5 6-5s6 2 6 5M17 11a2.5 2.5 0 1 0 0-5M17.5 14.2c2.2.4 3.5 2 3.5 4.8',
  back: 'M15 5l-7 7 7 7',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  plus: 'M12 5v14M5 12h14',
} as const

export function Icon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

export function PageHeader({ title, subtitle, back }: { title: string; subtitle?: ReactNode; back?: ReactNode }) {
  return (
    <header className="page-head">
      {back}
      <h1>{title}</h1>
      {subtitle && <p className="sub">{subtitle}</p>}
    </header>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  )
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      <p className="sub">{hint}</p>
    </div>
  )
}

export function Avatar({ name }: { name: string }) {
  return <span className="avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
}

export function RoleChip({ role }: { role: string }) {
  return <span className={`chip chip-${role}`}>{role}</span>
}

export function Callout({ tone, children }: { tone: 'error' | 'ok' | 'info'; children: ReactNode }) {
  return <div className={`callout callout-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}
