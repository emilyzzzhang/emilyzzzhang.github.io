import { useEffect, useRef, type ReactNode } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTypewriter } from '../../hooks/useTypewriter';

/** Room kept below the line being typed when the panel scrolls to follow it, in px. */
const FOLLOW_MARGIN = 48;

/** The nearest ancestor that scrolls (the panel body), or null. */
function scrollParent(el: HTMLElement | null) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

interface TypedSectionProps {
  /** Text typed out each time the section opens, paragraph after paragraph. */
  paragraphs: string[];
  className?: string;
  paragraphClassName?: string;
  /** Scroll the panel to follow the typing (and what follows it) when it runs past the bottom. */
  follow?: boolean;
  /** The rest of the section, which fades in once the typing has finished. */
  children?: ReactNode;
}

/**
 * A section whose text types itself out each time it opens, like a little dialogue; a click shows
 * it all at once. Untyped text is laid out but invisible, so the panel never jumps, and the full
 * text is always there for screen readers. With `follow`, if the text runs past the bottom of the
 * panel, the panel scrolls to keep the line being typed in view, and then on to what fades in after
 * it, until the visitor scrolls it themselves.
 */
export function TypedSection({ paragraphs, className = 'section', paragraphClassName, follow = false, children }: TypedSectionProps) {
  const { shown, done, skip } = useTypewriter(paragraphs, useReducedMotion());
  const root = useRef<HTMLDivElement>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const following = useRef(follow);
  // Found once: looking it up reads styles up the page, too much for every character typed.
  const scrollerRef = useRef<HTMLElement | null>(null);

  // Stop following as soon as the visitor scrolls the panel themselves.
  useEffect(() => {
    const scroller = (scrollerRef.current = scrollParent(root.current));
    if (!scroller) return;
    const stop = () => (following.current = false);
    scroller.addEventListener('wheel', stop, { passive: true });
    scroller.addEventListener('touchmove', stop, { passive: true });
    return () => {
      scroller.removeEventListener('wheel', stop);
      scroller.removeEventListener('touchmove', stop);
    };
  }, []);

  // Keep the line being typed in view, then carry on down to what fades in after it (the interests).
  useEffect(() => {
    const scroller = scrollerRef.current;
    const target = done ? root.current : caret.current;
    if (!scroller || !following.current || !target) return;
    const bottom = target.getBoundingClientRect().bottom - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const top = bottom + (done ? 0 : FOLLOW_MARGIN) - scroller.clientHeight;
    if (top > scroller.scrollTop) scroller.scrollTo({ top, behavior: 'smooth' });
  }, [shown, done]);

  let offset = 0;

  return (
    <div ref={root} className={`${className}${done ? ' section--typed' : ''}`} onClick={skip}>
      {paragraphs.map((paragraph) => {
        const typed = Math.max(0, Math.min(paragraph.length, shown - offset));
        const typing = typed > 0 && typed < paragraph.length;
        offset += paragraph.length;
        return (
          <p key={paragraph} className={paragraphClassName}>
            <span className="visually-hidden">{paragraph}</span>
            <span aria-hidden="true">
              {paragraph.slice(0, typed)}
              {typing && <span ref={caret} className="typewriter__caret" />}
              <span className="typewriter__rest">{paragraph.slice(typed)}</span>
            </span>
          </p>
        );
      })}
      {children && <div className="section__after-typing">{children}</div>}
    </div>
  );
}
