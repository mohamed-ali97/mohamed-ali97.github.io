// Social links grounded in the user's own messages and memory (Nov 25, 2026). Facebook has no URL yet, so it is not rendered.
const LINKS = [
  { id: 'facebook', url: '', label: 'Facebook', d: 'M14 8V6.5c0-.8.3-1.1 1.1-1.1H17V2h-2.7C11.4 2 10 3.7 10 6.2V8H7.5v3.4H10V22h4V11.4h2.7L17 8z' },
  { id: 'behance', url: 'https://behance.net/mohamedali31', label: 'Behance', d: 'M3 5h6.2c2.4 0 3.8 1.1 3.8 3 0 1.3-.7 2.2-1.8 2.6 1.5.4 2.4 1.5 2.4 3.1 0 2.2-1.7 3.3-4.2 3.3H3zm3.1 2.6v2.2h2.4c.8 0 1.3-.4 1.3-1.1s-.5-1.1-1.3-1.1zm0 4.6v2.5h2.7c.9 0 1.5-.5 1.5-1.2s-.6-1.3-1.5-1.3zM15.5 7h5v1.3h-5zM18 9.5c2.3 0 3.8 1.6 3.8 4.1v.6h-5.6c.1 1 .8 1.7 1.9 1.7.8 0 1.4-.3 1.6-.9h1.9c-.4 1.7-1.8 2.7-3.6 2.7-2.3 0-3.9-1.7-3.9-4.1S15.7 9.5 18 9.5zm-1.7 3.3h3.4c-.1-.9-.7-1.5-1.7-1.5-.9 0-1.6.5-1.7 1.5z' },
  { id: 'tiktok', url: 'https://www.tiktok.com/@zenda.2008', label: 'TikTok', d: 'M16.6 2h-3.2v13.3a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V9.4a5.9 5.9 0 1 0 5.1 5.9V8.6a7.3 7.3 0 0 0 4.2 1.3V6.7a4.2 4.2 0 0 1-4.2-4.7z' },
  { id: 'instagram', url: 'https://www.instagram.com/zenda.2008', label: 'Instagram', d: 'M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4zM12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm5.2-3.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z' },
].filter((l) => l.url)
export const SOCIALS = LINKS

export default function Socials({ size = 'h-9 w-9', className = '' }) {
  return (
    <ul className={'flex items-center gap-2 ' + className} aria-label="Social links">
      {LINKS.map((l) => (
        <li key={l.id}>
          <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.label} title={l.label}
            className={size + ' grid place-items-center rounded-full border border-zinc-600 bg-zinc-900/70 text-zinc-200 transition hover:border-gold hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold'}>
            <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="currentColor" aria-hidden="true"><path d={l.d} /></svg>
          </a>
        </li>
      ))}
    </ul>
  )
}
