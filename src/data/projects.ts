import type { Project } from '../types/portfolio';

// githubUrl / demoUrl / image are optional — each only renders when set.
// Screenshots: put files in public/images/projects/ and add, for example,
//   image: { src: 'images/projects/hexahaven.png', alt: 'HexaHaven game board' },
// A missing or broken image falls back to the illustrated placeholder.
export const projects: Project[] = [
  {
    id: 'paws-in-peril',
    title: 'Paws in Peril',
    description:
      'A multiplayer 2D pixel animal-rescue game with Dijkstra-based NPC pathfinding and core gameplay systems. Awarded Best Course Project in Software Design.',
    tags: ['Python', 'Design Patterns', 'OOP', 'pytest'],
    githubUrl: 'https://github.com/Negar-Badr/Paws-in-Peril-House',
    image: {
      src: 'images/projects/paws-in-peril.gif',
      alt: 'Paws in Peril gameplay: a pixel-art player walks through a forest maze of trees and rocks, past bunnies, monkeys and other animals to rescue.',
    },
    accent: 'peach',
  },
  {
    id: 'hexahaven',
    title: 'HexaHaven',
    description:
      'A multiplayer hex-strategy game of resource collection, trades and settlement building, with procedural terrain from multi-octave fBm gradient noise and weighted biome selection.',
    tags: ['TypeScript', 'Phaser 3', 'Vite', 'Node.js', 'Socket.IO', 'Firebase'],
    githubUrl: 'https://github.com/AustinKol/HexaHaven',
    image: {
      src: 'images/projects/hexahaven.jpg',
      alt: 'HexaHaven map screen: a procedurally generated board of numbered hex tiles in sand, grass, stone and water biomes, set in a turquoise sea.',
    },
    accent: 'lavender',
  },
  {
    id: 'innerspace',
    title: 'InnerSpace',
    description:
      'An AI-powered journaling app with voice and text input, Gemini-generated follow-up prompts, and automatic extraction of moods, summaries and actionable insights.',
    tags: ['TypeScript', 'Next.js', 'Prisma', 'PostgreSQL', 'Zod', 'Gemini API'],
    githubUrl: 'https://github.com/pearjuicee/Innerspace',
    image: {
      src: 'images/projects/innerspace.jpg',
      alt: 'InnerSpace journal page: record and generate-entry buttons, follow-up questions, a monthly calendar and a transcript box over a pastel sky.',
    },
    accent: 'rose',
  },
];
