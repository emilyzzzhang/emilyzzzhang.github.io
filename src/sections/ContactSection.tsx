import type { JSX } from 'react';
import { Placeholder } from '../components/ui/Placeholder';
import { contactLinks } from '../data/profile';
import type { ContactLink } from '../types/portfolio';

const ICONS: Record<ContactLink['id'], JSX.Element> = {
  email: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M5.2 8.6h3v10.2h-3zM6.7 4a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Zm3.4 4.6h2.9v1.4h.04c.4-.76 1.38-1.56 2.85-1.56 3.05 0 3.61 2 3.61 4.62v5.74h-3v-5.1c0-1.21-.02-2.78-1.7-2.78-1.69 0-1.95 1.32-1.95 2.69v5.19h-3z" />
    </svg>
  ),
};

export function ContactSection() {
  return (
    <div className="section">
      <p className="section__intro">
        Feel free to reach out about any opportunities, collaborations, or just to say hi. My inbox is always open!
      </p>
      <ul className="contact-list">
        {contactLinks.map(({ id, label, href, display }) => (
          <li key={id}>
            {href ? (
              <a className="contact-link" href={href} {...(id === 'email' ? {} : { target: '_blank', rel: 'noreferrer' })}>
                <span className="contact-link__icon" aria-hidden="true">
                  {ICONS[id]}
                </span>
                <span>
                  <span className="contact-link__label">{label}</span>
                  <span className="contact-link__value">{display ?? href}</span>
                </span>
              </a>
            ) : (
              <div className="contact-link contact-link--empty">
                <span className="contact-link__icon" aria-hidden="true">
                  {ICONS[id]}
                </span>
                <span>
                  <span className="contact-link__label">{label}</span>
                  <Placeholder>Not added yet</Placeholder>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
