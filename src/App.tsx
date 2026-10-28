import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Footer } from './components/layout/Footer';
import { Hero } from './components/layout/Hero';
import { LoadingScreen } from './components/layout/LoadingScreen';
import { Navbar } from './components/layout/Navbar';
import { SceneErrorBoundary, SceneFallback } from './components/layout/SceneFallback';
import { DriftingClouds } from './components/layout/DriftingClouds';
import { StarrySky } from './components/layout/StarrySky';
import { InfoPanel } from './components/ui/InfoPanel';
import { MusicControl } from './components/ui/MusicControl';
import { MOBILE_BREAKPOINT } from './config/layout';
import { useMediaQuery } from './hooks/useMediaQuery';
import { MusicProvider } from './hooks/useMusic';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useResumeAvailable } from './hooks/useResumeAvailable';
import { useTimeOfDay } from './hooks/useTimeOfDay';
import { AboutSection } from './sections/AboutSection';
import { ContactSection } from './sections/ContactSection';
import { EducationSection } from './sections/EducationSection';
import { ExperienceSection } from './sections/ExperienceSection';
import { ProjectsSection } from './sections/ProjectsSection';
import { ResumeSection } from './sections/ResumeSection';
import type { SectionId } from './types/portfolio';
import { isWebGL2Available } from './utils/webgl';

// three.js is only downloaded when the device can actually render the room.
const RoomScene = lazy(() => import('./components/3d/RoomScene'));
const LOADING_TIMEOUT_MS = 10_000;

export default function App() {
  const [section, setSection] = useState<SectionId | null>(null);
  // Expanding is per visit to a section: every open, switch or close starts back at half width.
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(() => !isWebGL2Available());
  const [sceneReady, setSceneReady] = useState(false);
  const reducedMotion = useReducedMotion();
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const resumeAvailable = useResumeAvailable();
  const [timeOfDay, toggleTimeOfDay] = useTimeOfDay();

  const openSection = useCallback((id: SectionId) => {
    setSection(id);
    setPanelExpanded(false);
  }, []);

  const closeSection = useCallback(() => {
    setSection(null);
    setPanelExpanded(false);
  }, []);
  const togglePanelExpanded = useCallback(() => setPanelExpanded((e) => !e), []);

  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  // Never let a stalled scene keep the loading screen over the (fully usable) HTML content.
  useEffect(() => {
    const timer = window.setTimeout(handleSceneReady, LOADING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [handleSceneReady]);

  const handleSceneError = useCallback(() => setSceneFailed(true), []);

  const renderSection = (id: SectionId) => {
    switch (id) {
      case 'about':
        return <AboutSection />;
      case 'projects':
        return <ProjectsSection />;
      case 'experience':
        return <ExperienceSection />;
      case 'education':
        return <EducationSection />;
      case 'contact':
        return <ContactSection />;
      case 'resume':
        return <ResumeSection available={resumeAvailable} onNavigate={openSection} />;
    }
  };

  return (
    <MusicProvider>
      <div className={`app${section ? ' app--panel-open' : ''}`}>
        <DriftingClouds />
        <StarrySky />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Navbar activeSection={section} onOpen={openSection} timeOfDay={timeOfDay} onToggleTime={toggleTimeOfDay} />

        <main id="main" className="stage">
          <div className="scene">
            {sceneFailed ? (
              <SceneFallback onOpen={openSection} />
            ) : (
              <SceneErrorBoundary onError={handleSceneError}>
                <Suspense fallback={null}>
                  <RoomScene
                    activeSection={section}
                    panelExpanded={panelExpanded}
                    onSelect={openSection}
                    timeOfDay={timeOfDay}
                    reducedMotion={reducedMotion}
                    lowPower={isMobile}
                    onReady={handleSceneReady}
                  />
                </Suspense>
              </SceneErrorBoundary>
            )}
            <p className="visually-hidden">
              An illustrated 3D studio: a desk with a computer, a coffee mug and an envelope, a bookshelf, framed pictures, a
              résumé poster, a guitar that plays a little tune, and Mochi the cat asleep on her cushion. Every object opens
              a section that is also available from the navigation above.
            </p>
          </div>

          <Hero dimmed={section !== null} />
          <InfoPanel
            section={section}
            expanded={panelExpanded}
            onToggleExpanded={togglePanelExpanded}
            onClose={closeSection}
            renderContent={renderSection}
          />
        </main>

        <Footer />
        <MusicControl />
        {!sceneFailed && <LoadingScreen done={sceneReady} />}
      </div>
    </MusicProvider>
  );
}
