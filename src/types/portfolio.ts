export const SECTION_IDS = ['about', 'projects', 'experience', 'education', 'resume', 'contact'] as const;

/** Every portfolio section a visitor can open, from the navbar or from an object in the room. */
export type SectionId = (typeof SECTION_IDS)[number];

export type Accent = 'rose' | 'peach' | 'lavender';

export interface SectionMeta {
  id: SectionId;
  navLabel: string;
  title: string;
  eyebrow: string;
  /** Tooltip shown when hovering the matching object in the room. */
  hoverLabel: string;
}

export interface ProjectImage {
  /** Path relative to public/, e.g. 'images/projects/hexahaven.png'. */
  src: string;
  alt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  githubUrl?: string;
  demoUrl?: string;
  /** Optional screenshot. Missing or broken images fall back to an illustrated placeholder. */
  image?: ProjectImage;
  accent: Accent;
  /** Placeholder entries render with a visible "placeholder" badge until replaced. */
  isPlaceholder?: boolean;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  focus: string;
  /** A short, high-level note on the work; the details live on the résumé. */
  summary: string;
  /** Optional — omitted from the entry when undefined. */
  location?: string;
  tags: string[];
  accent: Accent;
}

export interface Education {
  institution: string;
  degree: string;
  period?: string;
  /** Crest shown beside the institution, under public/. */
  logo?: { src: string; alt: string };
  coursework: string[];
}

export interface ContactLink {
  id: 'email' | 'github' | 'linkedin';
  label: string;
  /** null until configured — the contact panel shows a placeholder instead of a broken link. */
  href: string | null;
  display: string | null;
}

export interface Profile {
  name: string;
  fullName: string;
  /** The homepage headline, and the line introducing you beneath it. */
  heroTitle: string;
  heroIntro: string;
  about: string[];
  interests: string[];
}
