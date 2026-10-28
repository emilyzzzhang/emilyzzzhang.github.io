import type { Experience } from '../types/portfolio';

export const experience: Experience[] = [
  {
    id: 'google',
    company: 'Google',
    role: 'Software Developer Intern',
    focus: 'Android XR',
    summary: 'Display and calibration tooling for Gemini-powered Android XR smart glasses.',
    period: 'May 2025 – Aug 2025',
    location: 'Waterloo, ON',
    highlights: [
      'Reduced color calibration preprocessing errors by 50% across lighting conditions with a Python statistical algorithm for pattern detection in noisy sensor data.',
      'Doubled API verification throughput by building an automated display API validation pipeline with ADB device orchestration and quantitative testing.',
      'Cut hardware and calibration debugging time by 50% with a Protobuf-based CLI diagnostic tool for device-data processing, reporting and visualization.',
    ],
    tags: ['Python', 'Android XR', 'ADB', 'Protobuf'],
    accent: 'lavender',
  },
  {
    id: 'autodesk',
    company: 'Autodesk',
    role: 'Software Developer Intern',
    focus: '3D software & OpenUSD',
    summary: 'OpenUSD workflows in Maya and 3ds Max.',
    period: 'Sept 2024 – Dec 2024',
    location: 'Montreal, QC',
    highlights: [
      'Implemented OpenUSD light-linking support in Maya and 3ds Max, enabling native light-to-object relationships in USD scenes and reducing manual setup effort by 40%.',
      'Built a Qt light selection widget with type-ahead search and USD path handling, reducing light-assignment time by 60% in large production scenes.',
    ],
    tags: ['C++', 'Python', 'Qt', 'OpenUSD', 'Maya', '3ds Max'],
    accent: 'rose',
  },
  {
    id: 'cibc',
    company: 'CIBC',
    role: 'AI/ML Software Developer Intern',
    focus: 'Retrieval & document automation',
    summary: 'Production AI systems for internal knowledge retrieval and compliance automation.',
    location: 'Toronto, ON',
    highlights: [
      'Developed a production RAG platform with an MCP integration layer using LangChain and Qdrant, combining vector search, BM25 and reranking to improve retrieval relevance by 20%.',
      'Implemented a mortgage validation engine on Databricks PySpark and Delta Lake, orchestrating AI document classification to cut manual review effort by 30%.',
    ],
    tags: ['Python', 'LangChain', 'Qdrant', 'MCP', 'PySpark', 'Databricks'],
    accent: 'peach',
  },
  {
    id: 'mcgill-research',
    company: 'McGill University',
    role: 'Undergraduate Research Assistant',
    focus: 'Rehabilitation technology',
    summary: 'Motion-capture tooling supporting post-stroke motor rehabilitation research (atrehab.ca).',
    location: 'Montreal, QC',
    highlights: [
      'Developed a Python biomechanical data pipeline for motion-capture and IMU sensor data, automating ingestion, signal processing, 3D movement reconstruction and upper-body classification.',
    ],
    tags: ['Python', 'Signal processing', 'Motion capture', 'IMU'],
    accent: 'lavender',
  },
];
