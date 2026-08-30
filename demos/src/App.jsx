import { About } from '@/components/About'
import { Contact } from '@/components/Contact'
import { CtaBand } from '@/components/CtaBand'
import { Hero } from '@/components/Hero'
import { PreviewRibbon } from '@/components/PreviewRibbon'
import { Reviews } from '@/components/Reviews'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'

/**
 * Demo site layout. Section order is fixed by CLAUDE.md:
 * hero, CTA, about, reviews, contact.
 *
 * Layout is identical for every prospect. Only `src/data/<slug>/site.js`
 * and `theme.css` change, so adding a business never means editing here.
 */
export default function App() {
  return (
    <>
      <PreviewRibbon />
      <SiteHeader />
      <main>
        <Hero />
        <CtaBand />
        <About />
        <Reviews />
        <Contact />
      </main>
      <SiteFooter />
    </>
  )
}
