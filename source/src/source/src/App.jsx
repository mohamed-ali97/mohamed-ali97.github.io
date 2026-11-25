import Socials from './Socials.jsx'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { T } from './i18n.js'

const Drive3D = lazy(() => import('./Drive3D.jsx'))
const canShow3D = () => {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

gsap.registerPlugin(ScrollTrigger, useGSAP)

const projects = [
  { id: '245562145', img: 'p3.png', accent: '#c1472b' },
  { id: '109293507', img: 'p9.png', accent: '#b8a07a' },
  { id: '245562509', img: 'p2.png', accent: '#f5b400' },
  { id: '189450841', img: 'p5.png', accent: '#2f80ed' },
  { id: '188645177', img: 'p6.png', accent: '#1a8f6b' },
  { id: '105371039', img: 'p10.jpg', accent: '#8bb31f' },
]
const btn = 'inline-block m-1.5 px-7 py-3 rounded-full border border-[#1c110c]/70 font-bold no-underline shadow-lg shadow-black/30 transition hover:-translate-y-0.5'

export default function App() {
  const root = useRef(null)
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en')
  const t = { ...T[lang], name: lang === 'ar' ? 'محمد علي' : 'Mohamed Ali' }
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = t.dir; localStorage.setItem('lang', lang) }, [lang, t.dir])
  const [sel, setSel] = useState(null)
  const [has3D] = useState(canShow3D)
  const [listView, setListView] = useState(false)
  const show3D = has3D && !listView

  useEffect(() => {
    if (!sel) return
    const k = (e) => e.key === 'Escape' && setSel(null)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [sel])

  useGSAP(() => {
    gsap.from('.hero-word', { yPercent: 115, duration: 1, ease: 'power4.out', stagger: 0.15, delay: 0.1 })
    gsap.from('.hero-fade', { opacity: 0, y: 24, duration: 0.8, stagger: 0.12, delay: 0.7, ease: 'power2.out' })
    gsap.to('.blob-a', { x: 70, y: 40, duration: 7, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    gsap.to('.blob-b', { x: -60, y: -40, duration: 9, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    gsap.utils.toArray('.project').forEach((el) => {
      gsap.from(el, { opacity: 0, y: 70, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } })
      gsap.fromTo(el.querySelector('.shot'), { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: el, scrub: true } })
    })
  }, { scope: root, dependencies: [show3D] })

  const nameParts = t.name.split(' ')
  const hasList = !show3D
  return (
    <div ref={root}>
      <nav className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-3 py-3 md:px-8 md:py-4 backdrop-blur bg-ink/60 md:px-8">
        <a href="#work" aria-label="Z" className="flex items-center"><svg viewBox="0 0 64 64" className="h-9 w-9 md:h-10 md:w-10" role="img" aria-hidden="true"><defs><linearGradient id="zrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe27a" /><stop offset="1" stopColor="#f0a500" /></linearGradient></defs><rect width="64" height="64" rx="14" fill="#10131c" /><path d="M12 14H52L46 25H12Z" fill="url(#zrg)"/><path d="M18 39H52V50H12Z" fill="url(#zrg)"/><path d="M52 14V25L24 50H12V39L40 14Z" fill="#c98200"/><path d="M52 14L46 25H34L40 14Z" fill="#8a5600"/><path d="M12 50L24 39H18Z" fill="#8a5600"/></svg></a>
        <div className="flex items-center gap-2 text-xs text-zinc-300 md:gap-6 md:text-base">
          <a href="#work">{t.work}</a><a href="#admin">{t.admin}</a><a href="#contact">{t.contact}</a>
          <Socials size="h-8 w-8" className="hidden md:flex" />
          {has3D && <button className="rounded-full border border-[#1c110c]/70 bg-[#4d362a] px-2.5 py-1 shadow-lg shadow-black/30 text-xs md:px-3 md:text-sm" onClick={() => setListView((v) => !v)}>{listView ? t.view3d : t.listView}</button>}
          <button className="rounded-full border border-[#1c110c]/70 bg-gold px-2.5 py-1 text-xs font-bold text-black shadow-lg shadow-black/30 md:px-3 md:text-sm" lang={lang === 'en' ? 'ar' : 'en'} onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>{t.switchTo}</button>
        </div>
      </nav>

      {show3D && <Suspense fallback={<div className="grid h-screen place-items-center text-zinc-400">{t.loading}</div>}><Drive3D projects={projects} t={t} /></Suspense>}
      {hasList && <>
        <header className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-16 text-center">
          <div className="blob-a absolute left-[8%] top-[8%] h-96 w-96 rounded-full bg-gold opacity-30 blur-[90px]" />
          <div className="blob-b absolute bottom-[6%] right-[8%] h-96 w-96 rounded-full bg-teal-500 opacity-30 blur-[90px]" />
          <p className="hero-fade relative z-10 text-sm uppercase tracking-[.2em] text-zinc-400">{t.role}</p>
          <h1 className="relative z-10 my-3 text-[clamp(2.8rem,10vw,7.5rem)] font-extrabold leading-none">
            {nameParts.map((w) => <span key={w} className="block overflow-hidden pb-[.08em]"><span className="hero-word block">{w}</span></span>)}
          </h1>
          <p className="hero-fade relative z-10 max-w-xl text-lg text-zinc-300">{t.lead}</p>
          <div className="hero-fade relative z-10 mt-5">
            <a className={btn + ' bg-gold text-black'} href="#work">{t.seeWork}</a>
            <a className={btn + ' border border-gold text-gold'} href="https://behance.net/mohamedali31">Behance</a>
          </div>
        </header>
        <main id="work" className="mx-auto max-w-6xl px-5 pt-24 pb-10">
          <h2 className="mb-12 text-4xl font-bold md:text-5xl">{t.selected}</h2>
          {projects.map((p, i) => (
            <article key={p.id} className="project mb-20 grid items-center gap-6 md:mb-28 md:grid-cols-2 md:gap-12">
              <button className={'shot cursor-zoom-in overflow-hidden rounded-2xl border-2 border-[#1c110c]/70 p-0 shadow-lg shadow-black/30 ' + (i % 2 ? 'md:order-2' : '')}
                style={{ boxShadow: `0 30px 60px -20px ${p.accent}` }} onClick={() => setSel(p)} aria-label={t.projects[p.id][0]}>
                <img src={'./img/' + p.img} alt={t.projects[p.id][0]} className="block w-full transition duration-500 hover:scale-105" />
              </button>
              <div>
                <span className="font-extrabold" style={{ color: p.accent }}>0{i + 1}</span>
                <h3 className="my-1.5 text-3xl font-bold md:text-5xl">{t.projects[p.id][0]}</h3>
                <p className="mb-4 text-zinc-400">{t.projects[p.id][1]}</p>
                <a className="font-bold no-underline" style={{ color: p.accent }} href={'https://www.behance.net/gallery/' + p.id}>{t.behance}</a>
              </div>
            </article>
          ))}
        </main>
      </>}

      <div className="overflow-hidden border-y border-zinc-800 bg-panel py-4" dir="ltr" aria-hidden="true">
        <div className="animate-marquee flex w-max">
          {[...t.skills, ...t.skills].map((s, i) => (
            <span key={i} className="mx-4 whitespace-nowrap text-2xl font-bold text-zinc-200">{s}<i className="mx-4 not-italic text-gold">✦</i></span>
          ))}
        </div>
      </div>

      <section id="admin" className="mx-auto max-w-5xl px-6 py-24">
        <h2 className="mb-12 text-4xl font-bold md:text-5xl">{t.expTitle}</h2>
        <h3 className="mb-2 text-2xl font-bold text-gold">{t.designTitle}</h3>
        <p className="mb-2 max-w-2xl text-zinc-300">{t.designLead}</p>
        <p className="mb-8 max-w-2xl text-sm text-zinc-400">{t.aiNote}</p>
        <ol className="border-s border-zinc-700">
          {t.designJobs.map((j) => (
            <li key={j.what + j.when} className="admin-item relative mb-10 ps-8">
              <span className="absolute -start-[7px] top-2 h-3 w-3 rounded-full bg-gold" />
              <p className="text-sm text-gold">{j.when}</p>
              <h4 className="text-2xl font-bold">{j.what}</h4>
              <p className="mb-2 text-zinc-400">{j.where}</p>
              <ul className="list-disc space-y-1 ps-5 text-zinc-300">{j.pts.map((x) => <li key={x}>{x}</li>)}</ul>
            </li>
          ))}
        </ol>
        <h3 className="mb-2 mt-16 text-2xl font-bold text-gold">{t.adminTitle}</h3>
        <p className="mb-8 max-w-2xl text-zinc-300">{t.adminLead}</p>
        <ol className="border-s border-zinc-700">
          {t.jobs.map((j) => (
            <li key={j.what + j.when} className="admin-item relative mb-10 ps-8">
              <span className="absolute -start-[7px] top-2 h-3 w-3 rounded-full bg-gold" />
              <p className="text-sm text-gold">{j.when}</p>
              <h4 className="text-2xl font-bold">{j.what}</h4>
              <p className="mb-2 text-zinc-400">{j.where}</p>
              <ul className="list-disc space-y-1 ps-5 text-zinc-300">{j.pts.map((x) => <li key={x}>{x}</li>)}</ul>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div><h3 className="mb-3 text-xl font-bold">{t.adminSkills}</h3>
            <ul className="flex flex-wrap gap-2">{t.skillsList.map((x) => <li key={x} className="rounded-full border border-[#1c110c]/70 bg-[#4d362a] px-3 py-1 text-sm text-zinc-100 shadow-lg shadow-black/30">{x}</li>)}</ul></div>
          <div><h3 className="mb-3 text-xl font-bold">{t.edu}</h3><p className="text-zinc-300">{t.eduText}</p><p className="mt-2 text-zinc-400">{t.langs}</p></div>
        </div>
      </section>

      <section id="contact" className="bg-panel px-6 py-24 text-center">
        <h2 className="mb-2 text-4xl font-bold">{t.contactTitle}</h2>
        <p className="text-zinc-400">{t.contactText}</p>
        <Socials size="h-12 w-12" className="mt-6 justify-center" />
        <div className="mt-5">
          <a className={btn + ' bg-gold text-black'} href="https://www.linkedin.com/in/mohamed-abousenna/">LinkedIn</a>
          <a className={btn + ' border border-gold text-gold'} href="https://behance.net/mohamedali31">Behance</a>
        </div>
      </section>
      <footer className="p-8 text-center text-zinc-500">© {t.name}</footer>

      {sel && (
        <div role="dialog" aria-modal="true" aria-label={t.projects[sel.id][0]} className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/90 p-5" onClick={() => setSel(null)}>
          <img src={'./img/' + sel.img} alt={t.projects[sel.id][0]} className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}
