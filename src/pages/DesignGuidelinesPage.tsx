import { type ReactNode } from 'react'
import { assets, componentInstructions, designSystem, setupInstructions, universalGuidelines } from '../data'

const SectionCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-3xl border border-white/5 bg-[#0B0F17]/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
    <h2 className="text-2xl font-semibold text-cyan-300">{title}</h2>
    <div className="mt-4 text-slate-300">{children}</div>
  </section>
)

type NestedValue = string | number | NestedRecord
type NestedRecord = { [key: string]: NestedValue }

const KeyValueList = ({ data, valueClassName }: { data: NestedRecord; valueClassName?: string }) => (
  <dl className="space-y-3">
    {Object.entries(data).map(([label, value]) => (
      <div key={label} className="flex flex-col gap-1 rounded-2xl bg-white/5 p-4">
        <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</dt>
        {value && typeof value === 'object' ? (
          <KeyValueList data={value as NestedRecord} valueClassName="text-sm text-slate-100" />
        ) : (
          <dd className={valueClassName ?? 'text-base text-white'}>{String(value)}</dd>
        )}
      </div>
    ))}
  </dl>
)

const Pill = ({ label }: { label: string }) => (
  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-widest text-cyan-200">
    {label}
  </span>
)

const List = ({ items }: { items: readonly string[] }) => (
  <ul className="space-y-2 text-sm leading-relaxed text-slate-200">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-3">
        <span className="mt-1 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.6)]" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
)

const ImageStrip = ({ title, urls }: { title: string; urls: readonly string[] }) => (
  <div>
    <h3 className="text-sm uppercase tracking-[0.3em] text-slate-500">{title}</h3>
    <div className="mt-3 grid grid-cols-3 gap-3">
      {urls.map((url) => (
        <div key={url} className="overflow-hidden rounded-2xl border border-white/5">
          <img src={`${url}&w=400&h=280`} alt={`${title} inspiration`} className="h-32 w-full object-cover" loading="lazy" />
        </div>
      ))}
    </div>
  </div>
)

export function DesignGuidelinesPage() {
  return (
    <div className="min-h-screen bg-[#020408] px-6 py-12 text-white md:px-12 lg:px-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <header className="rounded-3xl border border-cyan-500/20 bg-gradient-to-r from-[#050709]/90 via-[#0b1221]/80 to-[#050709]/90 p-8 shadow-[0_0_50px_rgba(0,240,255,0.15)]">
          <Pill label="FoundersLib Design DNA" />
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-6xl">Bioluminescent Void Playbook</h1>
          <p className="mt-4 text-lg text-slate-300">
            Use this page as the single source of truth for implementing FoundersLib across landing, marketing, and
            dashboard surfaces. Every section is sourced from <code className="text-cyan-300">design_guidelines.json</code> to keep
            the build and documentation in sync.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          <SectionCard title="Identity">
            <dl className="space-y-4">
              <div>
                <dt className="text-sm uppercase tracking-[0.3em] text-slate-500">Name</dt>
                <dd className="text-2xl font-semibold text-white">{designSystem.identity.name}</dd>
              </div>
              <div>
                <dt className="text-sm uppercase tracking-[0.3em] text-slate-500">Vibe</dt>
                <dd className="text-xl text-cyan-200">{designSystem.identity.vibe}</dd>
              </div>
              <div>
                <dt className="text-sm uppercase tracking-[0.3em] text-slate-500">Core Philosophy</dt>
                <dd className="text-base text-slate-200">{designSystem.identity.corePhilosophy}</dd>
              </div>
              <div>
                <dt className="text-sm uppercase tracking-[0.3em] text-slate-500">Reference</dt>
                <dd className="text-base text-slate-200">{designSystem.identity.reference}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Typography">
            <div className="space-y-6">
              <div>
                <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">Font Families</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {Object.entries(designSystem.typography.fontFamily).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm">
                      <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500">{key}</span>
                      <p className="mt-1 text-slate-100">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">Scale</h3>
                <List items={Object.entries(designSystem.typography.scale).map(([k, v]) => `${k}: ${v}`)} />
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Color System">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">Palette</h3>
              <KeyValueList data={designSystem.colors.palette} />
            </div>
            <div className="space-y-4">
              <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">Gradients</h3>
              <List items={Object.entries(designSystem.colors.gradients).map(([k, v]) => `${k}: ${v}`)} />
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-8 lg:grid-cols-3">
          <SectionCard title="Spacing & Layout">
            <List
              items={[
                `Container: ${designSystem.spacing.containerPadding}`,
                `Section gap: ${designSystem.spacing.sectionGap}`,
                `Element gap: ${designSystem.spacing.elementGap}`,
                `Marketing: ${designSystem.layoutStrategies.marketing}`,
                `Dashboard: ${designSystem.layoutStrategies.dashboard}`,
                `Lists: ${designSystem.layoutStrategies.lists}`
              ]}
            />
          </SectionCard>
          <SectionCard title="Visual Enhancers">
            <List items={Object.entries(designSystem.visualEnhancers).map(([k, v]) => `${k}: ${v}`)} />
          </SectionCard>
          <SectionCard title="Component Tokens">
            <List
              items={[
                ...Object.entries(componentInstructions.buttons).map(([k, v]) => `Button (${k}): ${v}`),
                ...Object.entries(componentInstructions.cards).map(([k, v]) => `Card (${k}): ${v}`),
                ...Object.entries(componentInstructions.inputs).map(([k, v]) => `Input (${k}): ${v}`)
              ]}
            />
          </SectionCard>
        </div>

        <SectionCard title="Asset Library">
          <div className="space-y-6">
            {Object.entries(assets.images).map(([label, urls]) => (
              <ImageStrip key={label} title={label} urls={urls} />
            ))}
            <p className="text-sm text-slate-400">{assets.icons}</p>
          </div>
        </SectionCard>

        <SectionCard title="Setup Instructions">
          <div className="space-y-6">
            <Pill label={setupInstructions.criticalAction} />
            <List items={setupInstructions.steps} />
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">tailwind.config.js</h3>
                <pre className="mt-3 max-h-[420px] overflow-auto rounded-2xl bg-black/60 p-4 text-sm text-cyan-100">
                  {setupInstructions.tailwindConfigContent}
                </pre>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">src/index.css</h3>
                <pre className="mt-3 max-h-[420px] overflow-auto rounded-2xl bg-black/60 p-4 text-sm text-cyan-100">
                  {setupInstructions.indexCssContent}
                </pre>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Universal Guidelines">
          <List items={[...universalGuidelines]} />
        </SectionCard>
      </div>
    </div>
  )
}
