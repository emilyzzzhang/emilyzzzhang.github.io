import type { ContactLink, Education, Profile } from '../types/portfolio';

// Edit freely — everything here is rendered as-is.
export const profile: Profile = {
  name: 'Emily',
  fullName: 'Emily Zhang',
  heroTitle: "Hi there, I'm Emily!",
  heroIntro: 'Welcome to my little studio!',
  about: [
    "Hi! I'm Emily, a software developer studying Computer Science at McGill University.",
    "I've had the chance to work on a lot of different things through my internships at Google, Autodesk, and CIBC, along with doing research at McGill. I've really enjoyed getting to explore different areas of tech along the way!",
    "I love working on projects that are both technically challenging and creative, which is part of why I decided to build this little 3D studio using React and Three.js.",
    "I'm also involved with McWICS as a Hackathon Director and volunteer with Girls Who Code, where I help students learn Python.",
    'Outside of tech, I love exploring new places, finding cute cafés, and spending time with my cat, Mochi. You might even spot Mochi sleeping somewhere in the studio!',
  ],
  interests: ['Software engineering', '3D graphics', 'Creative technology'],
};

export const education: Education = {
  institution: 'McGill University',
  degree: 'BSc in Computer Science and Artificial Intelligence',
  period: 'Expected 2027',
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
  interests: ['Software engineering', '3D graphics', 'Creative technology', 'Artificial intelligence'],
};

export const contactLinks: ContactLink[] = [
  { id: 'email', label: 'Email', href: 'mailto:zhangemily0820@gmail.com', display: 'zhangemily0820@gmail.com' },
  { id: 'github', label: 'GitHub', href: 'https://github.com/emilyzzzhang', display: 'github.com/emilyzzzhang' },
  { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/emilyzzzhang3/', display: 'linkedin.com/in/emilyzzzhang3' },
];

/** Drop a file at public/resume.pdf and the Résumé panel will show it automatically. */
export const RESUME_URL = `${import.meta.env.BASE_URL}resume.pdf`;
