export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow glow-a" aria-hidden="true" />
      <div className="bg-glow glow-b" aria-hidden="true" />
      {children}
    </div>
  )
}
