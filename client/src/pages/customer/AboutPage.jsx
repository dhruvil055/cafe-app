import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import styles from './AboutPage.module.css';

const TOTAL_FRAMES = 240;
const BASE_FRAME_PATH = '/coffee-frames/ezgif-frame-';

const STORY_MOMENTS = [
  {
    id: '1',
    start: 1,
    end: 40,
    heading: 'THE BEGINNING',
    subtext: 'Every great cup starts with carefully selected coffee beans.',
    className: styles.moment1,
  },
  {
    id: '2',
    start: 41,
    end: 80,
    heading: 'CRAFTED WITH CARE',
    subtext: 'Precision. Patience. Perfect balance.',
    className: styles.moment2,
  },
  {
    id: '3',
    start: 81,
    end: 120,
    heading: 'THE PERFECT POUR',
    subtext: 'Rich aroma. Deep character. Smooth finish.',
    className: styles.moment3,
  },
  {
    id: '4',
    start: 121,
    end: 160,
    heading: 'BREWED IN THE MOMENT',
    subtext: 'Where craftsmanship meets the perfect extraction.',
    className: styles.moment4,
  },
  {
    id: '5',
    start: 161,
    end: 200,
    heading: 'RICH. WARM.\nAROMATIC.',
    subtext: 'Made to slow you down and savor.',
    className: styles.moment5,
  },
  {
    id: '6',
    start: 201,
    end: 230,
    heading: 'YOUR CUP IS READY',
    subtext: 'Take a moment. Enjoy every single sip.',
    className: styles.moment6,
  },
  {
    id: 'final',
    start: 231,
    end: 240,
    heading: 'EVERY CUP\nTELLS A STORY.',
    subtext: 'Experience artisanal coffee at Brewhaus.',
    className: styles.momentFinal,
  },
];

export default function AboutPage() {
  const canvasRef = useRef(null);
  const progressBarFillRef = useRef(null);
  const progressDotRef = useRef(null);
  const progressCounterRef = useRef(null);
  const scrollCueRef = useRef(null);
  const containerRef = useRef(null);

  const [activeMoment, setActiveMoment] = useState(-1);
  const [exitingMoment, setExitingMoment] = useState(-1);

  useEffect(() => {
    window.scrollTo(0, 0);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Image Caching State
    const frames = new Array(TOTAL_FRAMES + 1);
    const loadedFlags = new Array(TOTAL_FRAMES + 1).fill(false);
    let lastDrawnFrame = -1;
    let isResizing = false;
    let animFrameId = null;

    // Scroll & Lerp State
    let targetFrame = 1;
    let currentFrame = 1;
    let currentActiveIndex = -1;

    function getFrameUrl(index) {
      const padded = String(index).padStart(3, '0');
      return `${BASE_FRAME_PATH}${padded}.jpg`;
    }

    function getBestLoadedFrame(target) {
      if (loadedFlags[target]) return target;
      let step = 1;
      while (target - step >= 1 || target + step <= TOTAL_FRAMES) {
        if (target - step >= 1 && loadedFlags[target - step]) {
          return target - step;
        }
        if (target + step <= TOTAL_FRAMES && loadedFlags[target + step]) {
          return target + step;
        }
        step++;
      }
      return 1;
    }

    function drawFrame(frameIndex, force = false) {
      if (!force && frameIndex === lastDrawnFrame && !isResizing) return;

      const resolvedIndex = getBestLoadedFrame(frameIndex);
      const img = frames[resolvedIndex];
      if (!img || !img.complete || img.naturalWidth === 0) return;

      const canvasW = canvas.width;
      const canvasH = canvas.height;
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;

      // Aspect-ratio cover math
      const scale = Math.max(canvasW / imgW, canvasH / imgH);
      const scaledW = imgW * scale;
      const scaledH = imgH * scale;
      const offsetX = (canvasW - scaledW) / 2;
      const offsetY = (canvasH - scaledH) / 2;

      ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
      lastDrawnFrame = frameIndex;
    }

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (lastDrawnFrame > 0) {
        drawFrame(lastDrawnFrame, true);
      }
    }

    function initPreload() {
      const firstImg = new Image();
      firstImg.src = getFrameUrl(1);

      const onFirstLoad = () => {
        if (loadedFlags[1]) return;
        frames[1] = firstImg;
        loadedFlags[1] = true;
        drawFrame(1, true);
        preloadMilestonesAndStream();
      };

      firstImg.onload = onFirstLoad;
      if (firstImg.complete && firstImg.naturalWidth > 0) {
        onFirstLoad();
      }
    }

    function preloadMilestonesAndStream() {
      const milestones = [24, 48, 72, 96, 120, 144, 168, 192, 216, 240];
      milestones.forEach((idx) => {
        if (idx !== 1 && !frames[idx]) {
          const img = new Image();
          img.src = getFrameUrl(idx);
          img.onload = () => {
            frames[idx] = img;
            loadedFlags[idx] = true;
          };
        }
      });

      const queue = [];
      for (let i = 2; i <= TOTAL_FRAMES; i++) {
        if (!milestones.includes(i)) {
          queue.push(i);
        }
      }

      const BATCH_SIZE = 8;
      let activeIndex = 0;

      function loadNextBatch() {
        if (activeIndex >= queue.length) return;
        const currentBatch = queue.slice(activeIndex, activeIndex + BATCH_SIZE);
        activeIndex += BATCH_SIZE;

        let loadedInBatch = 0;
        currentBatch.forEach((frameIdx) => {
          const img = new Image();
          img.src = getFrameUrl(frameIdx);
          img.onload = () => {
            frames[frameIdx] = img;
            loadedFlags[frameIdx] = true;
            loadedInBatch++;
            if (loadedInBatch === currentBatch.length) {
              loadNextBatch();
            }
          };
          img.onerror = () => {
            loadedInBatch++;
            if (loadedInBatch === currentBatch.length) {
              loadNextBatch();
            }
          };
        });
      }

      loadNextBatch();
    }

    function getScrollProgress() {
      const track = containerRef.current;
      const trackHeight = track ? track.scrollHeight : 0;
      const totalScroll = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        trackHeight - window.innerHeight,
        1
      );
      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      return Math.min(Math.max(currentScroll / totalScroll, 0), 1);
    }

    function onScroll() {
      const progress = getScrollProgress();
      const frameOffset = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(progress * (TOTAL_FRAMES - 1))));
      targetFrame = 1 + frameOffset;

      if (progressBarFillRef.current && progressDotRef.current) {
        const percent = (progress * 100).toFixed(2);
        progressBarFillRef.current.style.height = `${percent}%`;
        progressDotRef.current.style.top = `${percent}%`;
      }

      if (scrollCueRef.current) {
        if (progress > 0.02) {
          scrollCueRef.current.classList.add(styles.isHidden);
        } else {
          scrollCueRef.current.classList.remove(styles.isHidden);
        }
      }
    }

    function updateMoments(frame) {
      let matchedIndex = -1;
      for (let i = 0; i < STORY_MOMENTS.length; i++) {
        if (frame >= STORY_MOMENTS[i].start && frame <= STORY_MOMENTS[i].end) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex !== currentActiveIndex) {
        setExitingMoment(currentActiveIndex);
        setActiveMoment(matchedIndex);
        currentActiveIndex = matchedIndex;
      }
    }

    function renderLoop() {
      onScroll();

      const delta = targetFrame - currentFrame;
      if (Math.abs(delta) > 0.005) {
        currentFrame += delta * 0.18;
      } else {
        currentFrame = targetFrame;
      }

      const roundedFrame = Math.round(currentFrame);
      const clampedFrame = Math.max(1, Math.min(TOTAL_FRAMES, roundedFrame));

      drawFrame(clampedFrame);
      updateMoments(clampedFrame);

      if (progressCounterRef.current) {
        progressCounterRef.current.textContent = `${String(clampedFrame).padStart(3, '0')} / 240`;
      }

      animFrameId = requestAnimationFrame(renderLoop);
    }

    // Initialize
    resizeCanvas();
    initPreload();
    onScroll();
    animFrameId = requestAnimationFrame(renderLoop);

    const handleScroll = () => onScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      isResizing = true;
      resizeTimeout = setTimeout(() => {
        resizeCanvas();
        isResizing = false;
      }, 100);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  return (
    <div className={styles.pageWrapper}>
      {/* Floating Top Navigation */}
      <header className={styles.topNav} aria-label="Brewhaus Navigation">
        <Link to="/menu" className={styles.backBtn}>
          <ArrowLeft size={15} />
          <span>Back to Menu</span>
        </Link>
        <Link to="/menu" className={styles.navBrand}>
          BREWHAUS
        </Link>
        <nav className={styles.navLinks}>
          <Link to="/menu" className={styles.navLink}>
            Menu
          </Link>
          <Link to="/offers" className={styles.navLink}>
            Offers
          </Link>
          <Link to="/contact" className={styles.navLink}>
            Contact
          </Link>
        </nav>
      </header>

      {/* Fixed Fullscreen Viewport */}
      <div className={styles.stickyViewport}>
        {/* Visual Canvas for 240 frames */}
        <canvas
          ref={canvasRef}
          className={styles.coffeeCanvas}
          aria-label="Interactive coffee cup animation"
          role="img"
        />

        {/* Ambient Vignette & Warm Glow */}
        <div className={styles.ambientVignette} aria-hidden="true" />

        {/* Minimal Progress Indicator */}
        <aside className={styles.progressIndicator} aria-label="Experience progress" aria-hidden="true">
          <div className={styles.progressTrack}>
            <div ref={progressBarFillRef} className={styles.progressBarFill} />
            <div ref={progressDotRef} className={styles.progressDot} />
          </div>
          <div ref={progressCounterRef} className={styles.progressCounter}>
            001 / 240
          </div>
        </aside>

        {/* Initial Scroll Cue */}
        <div ref={scrollCueRef} className={styles.initialScrollCue} aria-hidden="true">
          <span className={styles.scrollCueText}>SCROLL TO POUR</span>
          <div className={styles.scrollCueIndicator}>
            <div className={styles.scrollCueLine} />
          </div>
        </div>

        {/* Story Moments Subtitles */}
        <div className={styles.storyOverlay} aria-live="polite">
          {STORY_MOMENTS.map((moment, idx) => {
            const isActive = activeMoment === idx;
            const isExiting = exitingMoment === idx && !isActive;

            let momentStateClass = '';
            if (isActive) momentStateClass = styles.isActive;
            else if (isExiting) momentStateClass = styles.isExiting;

            const isFinal = moment.id === 'final';

            return (
              <article
                key={moment.id}
                className={`${styles.storyMoment} ${moment.className} ${momentStateClass}`}
              >
                <h2 className={styles.momentHeading}>
                  {moment.heading.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < moment.heading.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </h2>
                {moment.subtext && <p className={styles.momentSubtext}>{moment.subtext}</p>}

                {isFinal && (
                  <div className={styles.finalActions}>
                    <Link to="/menu" className={styles.primaryCta}>
                      Explore Menu <ArrowRight size={15} />
                    </Link>
                    <Link to="/contact" className={styles.secondaryCta}>
                      Visit Brewhaus
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {/* 600vh Scroll Height Track */}
      <div ref={containerRef} className={styles.experienceContainer} aria-hidden="true" />
    </div>
  );
}
