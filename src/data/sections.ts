import type { SectionId, SectionMeta } from '../types/portfolio';

export const SECTIONS: Record<SectionId, SectionMeta> = {
  about: {
    id: 'about',
    navLabel: 'About',
    title: 'About Me',
    eyebrow: 'The coffee mug',
    hoverLabel: 'About Me',
  },
  projects: {
    id: 'projects',
    navLabel: 'Projects',
    title: 'Projects',
    eyebrow: 'On the screen',
    hoverLabel: 'View Projects',
  },
  experience: {
    id: 'experience',
    navLabel: 'Experience',
    title: 'Experience',
    eyebrow: 'The picture wall',
    hoverLabel: 'View Experience',
  },
  education: {
    id: 'education',
    navLabel: 'Education',
    title: 'Education',
    eyebrow: 'The bookshelf',
    hoverLabel: 'View Education',
  },
  resume: {
    id: 'resume',
    navLabel: 'Resume',
    title: 'Résumé',
    eyebrow: 'The poster',
    hoverLabel: 'View Résumé',
  },
  contact: {
    id: 'contact',
    navLabel: 'Contact',
    title: 'Say hello',
    eyebrow: 'The envelope',
    hoverLabel: 'Contact Me',
  },
};

export const NAV_ORDER: SectionId[] = ['about', 'projects', 'experience', 'education', 'resume', 'contact'];
