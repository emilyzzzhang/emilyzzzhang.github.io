import type { ContactLink, Education, Profile } from '../types/portfolio';

// Edit freely — everything here is rendered as-is.
export const profile: Profile = {
  name: 'Emily',
  fullName: 'Emily Zhang',
  heroTitle: "Hi there, I'm Emily!",
  heroIntro: 'Welcome to my little studio!',
  about: [
    "Hi! I'm Emily, a software developer studying Computer Science at McGill University.",
    "I've always loved working on things that are both technical and creative, so I thought it'd be fun to build my own little 3D studio using React and Three.js! Feel free to look around, check out my résumé, and explore some of the things I've worked on.",
    'Outside of coding, I love exploring new places, finding cute cafés, and spending time with my cat, Mochi. You might even spot her sleeping somewhere in the studio :))',
  ],
  interests: [
    '3D Graphics & Interactive Experiences',
    'Software Engineering',
    'Full-Stack Development',
    'Computer Vision',
    'Machine Learning & AI',
    'Developer Tools',
  ],
};

export const education: Education = {
  institution: 'McGill University',
  degree: 'BSc in Computer Science and Artificial Intelligence',
  period: 'Expected 2027',
  logo: { src: `${import.meta.env.BASE_URL}images/logos/mcgill.png`, alt: 'McGill University crest' },
  coursework: [
    'Data Structures & Algorithms',
    'Operating Systems',
    'Software Design',
    'Computer Architecture',
    'Artificial Intelligence',
    'Applied Machine Learning',
    'Natural Language Processing',
    'Databases',
    'Statistics',
    'Probability',
  ],
};

export const contactLinks: ContactLink[] = [
  { id: 'email', label: 'Email', href: 'mailto:zhangemily0820@gmail.com', display: 'zhangemily0820@gmail.com' },
  { id: 'github', label: 'GitHub', href: 'https://github.com/emilyzzzhang', display: 'github.com/emilyzzzhang' },
  { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/emilyzzzhang3/', display: 'linkedin.com/in/emilyzzzhang3' },
];

/** Drop a file at public/resume.pdf and the Résumé panel will show it automatically. */
export const RESUME_URL = `${import.meta.env.BASE_URL}resume.pdf`;
