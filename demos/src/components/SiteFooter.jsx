import { Separator } from '@/components/ui/separator'
import { BUSINESS, NAV } from '@/data/site'
import { telHref } from '@/lib/utils'

export function SiteFooter() {
  const tel = telHref(BUSINESS.phone)
  const year = new Date().getFullYear()

  return (
    <footer className="bg-background">
      <div className="container py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-lg font-bold tracking-tight">{BUSINESS.name}</p>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-muted-foreground">
              {BUSINESS.tagline}
            </p>
            {BUSINESS.address ? (
              <p className="mt-3 text-[0.85rem] leading-relaxed text-muted-foreground">
                {BUSINESS.address}
              </p>
            ) : null}
          </div>

          <nav className="flex flex-col gap-2.5">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-[0.88rem] text-muted-foreground transition-colors hover:text-brand"
              >
                {item.label}
              </a>
            ))}
            {tel ? (
              <a
                href={tel}
                className="text-[0.88rem] tabular-nums text-muted-foreground transition-colors hover:text-brand"
              >
                {BUSINESS.phone}
              </a>
            ) : null}
          </nav>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.78rem] leading-relaxed text-muted-foreground">
            © {year} {BUSINESS.name}. {BUSINESS.legalNote}
          </p>
          <p className="text-[0.78rem] text-muted-foreground">
            Concept by{' '}
            <a
              href="https://www.htpdevs.tech"
              className="font-semibold text-brand transition-colors hover:text-brand-ink"
              rel="noopener noreferrer"
              target="_blank"
            >
              &gt; HTPdevs
            </a>
          </p>
        </div>

        <p className="mt-6 max-w-3xl text-[0.72rem] leading-relaxed text-muted-foreground/70">
          {BUSINESS.sourceNote}
        </p>
      </div>
    </footer>
  )
}
