import { useEffect, useState } from 'react'
import { Menu, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { BrandMark } from '@/components/BrandMark'
import { BUSINESS, CTA, DESIGN, NAV } from '@/data/site'
import { telHref } from '@/lib/utils'

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const tel = telHref(BUSINESS.phone)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors ${
        scrolled
          ? 'border-border bg-[hsl(var(--background)/0.9)] backdrop-blur'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="container flex h-16 items-center justify-between gap-3 sm:h-[4.5rem]">
        <a
          href="#top"
          className="flex min-w-0 items-center gap-2.5 font-display text-[0.95rem] font-bold leading-tight tracking-tight sm:text-lg"
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand text-primary-foreground sm:size-9"
          >
            <BrandMark name={DESIGN.mark} />
          </span>
          <span className="truncate">{BUSINESS.name}</span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="text-[0.88rem] font-medium text-muted-foreground transition-colors hover:text-brand"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {tel ? (
            <a
              href={tel}
              className="hidden items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[0.85rem] font-medium tabular-nums transition-colors hover:border-brand hover:text-brand md:inline-flex"
            >
              <Phone className="size-3.5" />
              {BUSINESS.phone}
            </a>
          ) : null}

          <Button asChild size="sm" className="hidden sm:inline-flex">
            <a href="#contact">{CTA.primary}</a>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle>{BUSINESS.name}</SheetTitle>
              <Separator />
              <nav className="flex flex-col gap-1">
                {NAV.map((item) => (
                  <SheetClose asChild key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="rounded-md px-2 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary hover:text-brand"
                    >
                      {item.label}
                    </a>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2.5">
                {tel ? (
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full">
                      <a href={tel}>
                        <Phone className="size-4" />
                        {BUSINESS.phone}
                      </a>
                    </Button>
                  </SheetClose>
                ) : null}
                <SheetClose asChild>
                  <Button asChild className="w-full">
                    <a href="#contact">{CTA.primary}</a>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
