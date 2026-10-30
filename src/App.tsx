import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Footer } from './components/layout/Footer';
import { Hero } from './components/layout/Hero';
import { LoadingScreen } from './components/layout/LoadingScreen';
import { Navbar } from './components/layout/Navbar';
import { SceneErrorBoundary, SceneFallback } from './components/layout/SceneFallback';
import { DriftingClouds } from './components/layout/DriftingClouds';
import { StarrySky } from './components/layout/StarrySky';
import { InfoPanel } from './components/ui/InfoPanel';
import { MOBILE_BREAKPOINT } from './config/layout';
import { useGuitarVisit } from './hooks/useGuitarVisit';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useMochiVisit } from './hooks/useMochiVisit';
import { useOutsideClick } from './hooks/useOutsideClick';
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
import { roomDownloaded } from './utils/roomDownload';
import { isWebGL2Available } from './utils/webgl';

// three.js is only downloaded when the device can actually render the room. The page's own
// script may already be fetching it for the loading bar; the import waits and reads it from cache.
const loadRoomScene = () => roomDownloaded().then(() => import('./components/3d/RoomScene'));
const RoomScene = lazy(loadRoomScene);
const LOADING_TIMEOUT_MS = 10_000;

export default function App() {
  const [section, setSection] = useState<SectionId | null>(null);
  // Expanding is per visit to a section: every open, switch or close starts back at half width.
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(() => !isWebGL2Available());
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneCodeLoaded, setSceneCodeLoaded] = useState(false);
  // Explore mode: the welcome text steps aside and the camera centres the whole room.
  const [exploring, setExploring] = useState(false);
  const reducedMotion = useReducedMotion();
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const resumeAvailable = useResumeAvailable();
  const [timeOfDay, toggleTimeOfDay] = useTimeOfDay();
  const mochi = useMochiVisit(reducedMotion);
  const endMochiVisit = mochi.end;
  const startMochiVisit = mochi.start;
  const guitar = useGuitarVisit(reducedMotion);
  const endGuitarVisit = guitar.end;
  const startGuitarVisit = guitar.start;

  const openSection = useCallback((id: SectionId) => {
    setSection(id);
    setPanelExpanded(false);
    endMochiVisit();
    endGuitarVisit();
  }, [endMochiVisit, endGuitarVisit]);

  const closeSection = useCallback(() => {
    setSection(null);
    setPanelExpanded(false);
    endMochiVisit();
    endGuitarVisit();
  }, [endMochiVisit, endGuitarVisit]);
  const visitMochi = useCallback(() => {
    if (!startMochiVisit()) return;
    setSection(null);
    setPanelExpanded(false);
    endGuitarVisit();
  }, [startMochiVisit, endGuitarVisit]);

  // A close-up of Mochi or the guitar: clicking elsewhere or Escape zooms out early.
  const mochiFocused = mochi.phase !== null;
  const closeUp = mochiFocused || guitar.visiting;
  useOutsideClick(closeUp, closeSection);
  useEffect(() => {
    if (!closeUp) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeSection();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeUp, closeSection]);
  // A click on the guitar starting its tune: visit it, unless a section or Mochi already has the camera.
  const visitGuitar = useCallback(() => {
    if (section === null && !mochiFocused) startGuitarVisit();
  }, [section, mochiFocused, startGuitarVisit]);
  const togglePanelExpanded = useCallback(() => setPanelExpanded((e) => !e), []);

  const startExploring = useCallback(() => setExploring(true), []);
  const stopExploring = useCallback(() => setExploring(false), []);
  // Back is only offered over the bare room, so Escape follows it; a panel or Mochi takes Escape first.
  const canGoBack = exploring && section === null && !closeUp;
  useEffect(() => {
    if (!canGoBack) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stopExploring();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canGoBack, stopExploring]);

  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  // Never let a stalled scene keep the loading screen over the (fully usable) HTML content.
  useEffect(() => {
    const timer = window.setTimeout(handleSceneReady, LOADING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [handleSceneReady]);

  // The loading bar's middle milestone: the three.js chunk has arrived and the room is being built.
  // The browser shares this download with the lazy() import above.
  useEffect(() => {
    if (sceneFailed) return;
    let live = true;
    loadRoomScene().then(
      () => live && setSceneCodeLoaded(true),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [sceneFailed]);

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
      <div className={`app${section ? ' app--panel-open' : ''}${canGoBack ? ' app--exploring' : ''}`}>
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
                    exploring={exploring}
                    onSelect={openSection}
                    onMiss={closeSection}
                    mochiVisit={mochi.phase}
                    onMochiClick={visitMochi}
                    guitarVisit={guitar.visiting}
                    onGuitarPlay={visitGuitar}
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

          <Hero dimmed={section !== null || closeUp || exploring} onExplore={startExploring} />
          <button type="button" className={`explore-back${canGoBack ? '' : ' explore-back--hidden'}`} onClick={stopExploring} inert={!canGoBack}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M13.5 8.4c-3-.6-6.4-.2-9.7-.8M7.3 4.6C6 5.9 4.7 6.9 3.7 7.9c1.2 1 2.4 2.3 3.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <InfoPanel
            section={section}
            expanded={panelExpanded}
            onToggleExpanded={togglePanelExpanded}
            onClose={closeSection}
            renderContent={renderSection}
          />
        </main>

        <Footer />
        {!sceneFailed && <LoadingScreen done={sceneReady} stage={sceneCodeLoaded ? 'building' : 'fetching'} />}
      </div>
    </MusicProvider>
  );
}
