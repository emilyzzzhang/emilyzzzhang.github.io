import type { Experience } from '../types/portfolio';

// A short, high-level note per role; the full details (and dates) are on the résumé.
export const experience: Experience[] = [
  {
    id: 'google',
    company: 'Google',
    role: 'Software Developer Intern',
    focus: 'Android XR',
    summary:
      'I worked on display calibration and testing tools for Android XR smart glasses. My main projects involved building Python algorithms to improve color accuracy, automating display testing through ADB, and creating a command-line tool to make hardware debugging easier.',
    location: 'Waterloo, ON',
    tags: ['Python', 'Android XR', 'ADB', 'Protobuf'],
    accent: 'lavender',
  },
  {
    id: 'autodesk',
    company: 'Autodesk',
    role: 'Software Developer Intern',
    focus: '3D Software & OpenUSD',
    summary:
      'I worked on light linking features for Maya and 3ds Max using OpenUSD, which lets artists control how different lights affect objects in a 3D scene. I also built a Qt-based light selection tool with search functionality to make working with large scenes easier.',
    location: 'Montréal, QC',
    tags: ['C++', 'Python', 'Qt', 'OpenUSD', 'Maya', '3ds Max'],
    accent: 'rose',
  },
  {
    id: 'cibc',
    company: 'CIBC',
    role: 'AI/ML Software Developer Intern',
    focus: 'AI Systems & Document Automation',
    summary:
      'I worked on AI tools to help automate internal workflows. One project was a RAG platform that combines vector search, keyword search, and reranking to retrieve more relevant information. I also worked on a mortgage document validation system using Databricks and AI-based document classification to automate parts of the review process.',
    location: 'Toronto, ON',
    tags: ['Python', 'LangChain', 'Qdrant', 'MCP', 'PySpark', 'Databricks'],
    accent: 'peach',
  },
  {
    id: 'mcgill-research',
    company: 'McGill University',
    role: 'Undergraduate Research Assistant',
    focus: 'Rehabilitation Technology',
    summary:
      'I worked on a research project focused on using motion data to support stroke rehabilitation. I built Python pipelines to process motion-capture and IMU sensor data, visualize 3D movements, and help classify different upper-body motions.',
    location: 'Montréal, QC',
    tags: ['Python', 'Signal Processing', 'Motion Capture', 'IMU'],
    accent: 'lavender',
  },
];
