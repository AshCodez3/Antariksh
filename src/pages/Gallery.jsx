import React, { useState, useEffect, useRef, useMemo } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { galleryMemories, astroPhotos } from "../data/galleryData";

function buildArch(w, h) {
  const isMobile = w <= 640;
  const cw = isMobile ? 85 : 175;
  const ch = isMobile ? 120 : 240;
  const gap = isMobile ? 10 : 22;

  const R = isMobile ? w * 0.95 : w * 0.8;
  const step = (cw + gap) / R;

  const thetaEdge = Math.asin(Math.min(1, (w / 2 + cw * 0.3) / R));
  const thetaMax = Math.asin(Math.min(1, (w / 2 + cw * 0.9) / R));

  const N = Math.ceil((2 * thetaMax) / step) + 2;
  const cx = w / 2;
  const cyE = 12 + R + ch / 2;
  const drop = R * (1 - Math.cos(thetaEdge));
  const H = 20 + ch * 1.08 + drop;

  return {
    w,
    R,
    cw,
    ch,
    step,
    thetaMax,
    N,
    loopLen: N * step,
    cx,
    cyE,
    H,
    overlap:
      !isMobile && w > 900 ? Math.max(0, Math.round(H - (ch + 12 + 70))) : 0,
    guide: {
      x1: cx - R * Math.sin(thetaMax),
      x2: cx + R * Math.sin(thetaMax),
      y: cyE - R * Math.cos(thetaMax),
    },
  };
}

export default function Gallery() {
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [apodData, setApodData] = useState({
    title: "Astronomy Picture of the Day",
    date: new Date().toISOString().slice(0, 10),
    explanation:
      "NASA’s Astronomy Picture of the Day brings a new view of our universe every day.",
    url: "https://apod.nasa.gov/apod/image/2208/Cartwheel_Webb_960.jpg",
    media_type: "image",
  });
  const [isApodModalOpen, setIsApodModalOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // ---------- Arch carousel engine ----------
  const stageRef = useRef(null);
  const cardRefs = useRef([]);
  const offsetRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const introRef = useRef(0);
  const rafRef = useRef(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  const rawItems = [...galleryMemories, ...astroPhotos].filter(
    (item) => item?.mediaImageUrl,
  );

  useEffect(() => {
    const measure = () => {
      if (!stageRef.current) return;
      const w = stageRef.current.clientWidth;
      const h = window.innerHeight;
      setViewport((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const arch = useMemo(
    () =>
      viewport.w && rawItems.length ? buildArch(viewport.w, viewport.h) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewport.w, viewport.h, rawItems.length],
  );

  useEffect(() => {
    if (!arch) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const AUTO_SPEED = reduceMotion ? 0 : -0.04;
    if (reduceMotion) introRef.current = 1;

    const { N, step, loopLen, thetaMax, R, cx, cyE, cw, ch } = arch;

    const render = () => {
      const p = introRef.current;
      const ease = 1 - Math.pow(1 - p, 3);
      const spin = offsetRef.current / R;

      for (let i = 0; i < N; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;

        let a = (((i * step + spin) % loopLen) + loopLen) % loopLen;
        if (a > loopLen / 2) a -= loopLen;

        if (Math.abs(a) > thetaMax) {
          el.style.visibility = "hidden";
          continue;
        }

        const theta = a * ease;
        const x = R * Math.sin(theta);
        const y = -R * Math.cos(theta);

        el.style.visibility = "visible";
        el.style.opacity = String(Math.min(1, p * 1.6));

        if (!el.matches(":hover")) {
          el.style.zIndex = String(
            100 - Math.round((Math.abs(theta) / thetaMax) * 100),
          );
        }

        el.style.transform = `translate3d(${cx + x - cw / 2}px, ${cyE + y - ch / 2}px, 0) rotate(${theta * 0.5}rad)`;
      }
    };

    let last = null;
    const tick = (time) => {
      if (last === null) last = time;
      const dt = Math.min(time - last, 50);
      last = time;

      if (!draggingRef.current) {
        velocityRef.current +=
          (AUTO_SPEED - velocityRef.current) * Math.min(1, dt / 700);
        offsetRef.current += velocityRef.current * dt;
      }
      if (introRef.current < 1) {
        introRef.current = Math.min(1, introRef.current + dt / 1600);
      }

      render();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [arch]);

  const handlePointerDown = (e) => {
    draggingRef.current = true;
    setIsInteracting(true);
    lastXRef.current = e.clientX;
    lastMoveTimeRef.current = performance.now();
    velocityRef.current = 0;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const now = performance.now();
    const dx = e.clientX - lastXRef.current;
    const dt = Math.max(1, now - lastMoveTimeRef.current);
    lastXRef.current = e.clientX;
    lastMoveTimeRef.current = now;
    offsetRef.current += dx;
    velocityRef.current = velocityRef.current * 0.6 + (dx / dt) * 0.4;
  };

  const handlePointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    velocityRef.current = Math.max(-2, Math.min(2, velocityRef.current));
    setIsInteracting(false);
  };

  useEffect(() => {
    fetch("https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&thumbs=true")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setApodData(data))
      .catch(() => {});
  }, []);

  const formatDate = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return isNaN(d.getTime())
      ? isoString
      : d
          .toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
          .toUpperCase();
  };

  const filteredMemories =
    selectedFilter === "all"
      ? galleryMemories
      : galleryMemories.filter((mem) => mem.category === selectedFilter);

  const getApodPageUrl = (data) =>
    `https://apod.nasa.gov/apod/ap${data.date.replaceAll("-", "").slice(2)}.html`;

  return (
    <div className="gallery-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,100..900;1,100..900&family=Carme&family=Cinzel+Decorative:wght@400;700;900&family=Cormorant+Unicase:wght@300;400;500;600;700&family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Figtree:ital,wght@0,300..900;1,300..900&family=Fira+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Fontdiner+Swanky&family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Geologica:wght,CRSV@100..900,0&family=Goudy+Bookletter+1911&family=Josefin+Sans:ital,wght@0,100..700;1,100..700&family=Lexend+Deca:wght@100..900&family=MedievalSharp&family=Metamorphous&family=Modern+Antiqua&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Oldenburg&family=Playwrite+PL:wght@100..400&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Prata&family=Roboto+Mono:ital,wght@0,100..700;1,100..700&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap');

        /* EXACT FULL VIEWPORT LANDING SECTION */
        .gallery-hero-container {
          height: 100vh;
          max-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: 130px;
          padding-bottom: 0 !important;
          box-sizing: border-box;
          position: relative;
          overflow: hidden !important;
        }

        .arch-stage-container {
          width: 100%;
          position: relative;
          z-index: 1;
          touch-action: pan-y;
          overflow: visible;
        }

        /* CARD HOVER ENHANCEMENTS */
        .arch-film-card {
          position: absolute;
          left: 0;
          top: 0;
          border-radius: 20px;
          overflow: hidden;
          background: #090d16;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.14);
          will-change: transform, opacity;
          backface-visibility: hidden;
          cursor: pointer;
        }

        .arch-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: inherit;
          overflow: hidden;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease;
        }

        .arch-film-card:hover {
          z-index: 999 !important;
        }

        .arch-film-card:hover .arch-card-inner {
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.9), 0 0 20px rgba(168, 85, 247, 0.35);
          border-color: rgba(168, 85, 247, 0.6);
        }

        /* Center-aligned sleek caption reveal */
        .arch-card-caption-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 1.25rem 0.75rem 0.85rem 0.75rem;
          background: linear-gradient(to top, rgba(9, 11, 19, 0.95) 0%, rgba(9, 11, 19, 0.7) 60%, transparent 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          text-align: center;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.25s ease, transform 0.25s ease;
          pointer-events: none;
        }

        .arch-film-card:hover .arch-card-caption-overlay {
          opacity: 1;
          transform: translateY(0);
        }

        /* DOTLESS SLEEK GLASS PILL */
        .hero-glass-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.38rem 1.15rem;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(192, 132, 252, 0.28);
          border-radius: 9999px;
          font-family: 'DM Mono', monospace;
          font-size: 0.68rem;
          letter-spacing: 0.22em;
          color: #c084fc;
          text-transform: uppercase;
          margin-bottom: 1.15rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          user-select: none;
        }

        /* SYMMETRICAL CLEAN HEADLINE (SAME FONT FAMILY) */
        .editorial-headline {
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          text-align: center;
        }

        /* Line 1: Clean, compact sans */
        .editorial-headline .line-1 {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(2.5rem, 2.1vw, 3.5rem);
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #f8fafc;
          line-height: 1.1;
          white-space: nowrap;
        }

        /* Line 2: Big, steep natural italic serif */
        .editorial-headline .line-2 {
          font-family: 'DM Sans', serif;
          font-style: italic;
          font-weight: 400;
          font-size: clamp(2.5rem, 4.4vw, 3.4rem);
          letter-spacing: 0.01em;
          line-height: 1.15;
          text-transform: lowercase;
          color: #d8b4fe;
          white-space: nowrap;
        }


        /* MOBILE ADJUSTMENTS */
        @media (max-width: 640px) {
          .gallery-hero-container {
            height: 100dvh !important;
            max-height: 100dvh !important;
            justify-content: center !important;
            padding-top: 20px !important;
            padding-bottom: 20px !important;
          }

          .gallery-hero-headings-box {
            padding: 0.5rem 1rem !important;
            margin-top: 0.25rem !important;
          }

          .arch-film-card {
            border-radius: 12px !important;
          }

          .arch-card-caption-overlay {
            padding: 0.75rem 0.4rem 0.5rem 0.4rem !important;
          }

          .arch-card-caption-overlay span {
            font-size: 0.48rem !important;
            margin-bottom: 1px !important;
          }

          .arch-card-caption-overlay p {
            font-size: 0.65rem !important;
          }

          .hero-glass-pill {
            font-size: 0.58rem !important;
            padding: 0.32rem 0.95rem !important;
            letter-spacing: 0.16em !important;
            margin-bottom: 1.5rem !important;
          }

          .editorial-headline {
            gap: 0.2rem !important;
          }

          .editorial-headline .line-1 {
            font-size: 1.7rem !important;
            letter-spacing: 0.06em !important;
          }

          .editorial-headline .line-2 {
            font-size: 1.2rem !important;
            letter-spacing: 0 !important;
          }
        }
      `}</style>

      <div className="noise" />
      <div className="gallery-page-video" aria-hidden="true">
        <video autoPlay muted playsInline loop preload="metadata">
          <source src="/static/assets/blue_galaxy.mp4" type="video/mp4" />
        </video>
      </div>

      <Navbar />

      <main>
        {/* 1. TOP LANDING: ARCH WITH PILL & TWO-LINE HEADLINE */}
        <section className="gallery-hero-container">
          <div
            ref={stageRef}
            className="arch-stage-container"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              height: arch ? arch.H : 320,
              cursor: isInteracting ? "grabbing" : "grab",
              userSelect: "none",
            }}
          >
            {arch && (
              <svg
                aria-hidden="true"
                width={arch.w}
                height={arch.H}
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                }}
              >
                <path
                  d={`M ${arch.guide.x1} ${arch.guide.y} A ${arch.R} ${arch.R} 0 0 1 ${arch.guide.x2} ${arch.guide.y}`}
                  fill="none"
                  stroke="rgba(192, 132, 252, 0.22)"
                  strokeWidth="1"
                  strokeDasharray="2 7"
                  strokeLinecap="round"
                />
              </svg>
            )}

            {arch &&
              Array.from({ length: arch.N }, (_, i) => {
                const item = rawItems[i % rawItems.length];
                return (
                  <div
                    key={i}
                    ref={(el) => {
                      cardRefs.current[i] = el;
                    }}
                    className="arch-film-card"
                    style={{
                      width: arch.cw,
                      height: arch.ch,
                      visibility: "hidden",
                    }}
                  >
                    <div className="arch-card-inner">
                      <img
                        src={item.mediaImageUrl}
                        alt={item.caption || "Antariksh Archive"}
                        draggable="false"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          pointerEvents: "none",
                        }}
                      />

                      <div className="arch-card-caption-overlay">
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.62rem",
                            letterSpacing: "0.14em",
                            color: "#c084fc",
                            textTransform: "uppercase",
                            marginBottom: "3px",
                          }}
                        >
                          {item.category || item.tagline || "ARCHIVE"}
                        </span>
                        <p
                          style={{
                            margin: 0,
                            color: "#ffffff",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            lineHeight: 1.25,
                            letterSpacing: "-0.01em",
                            maxWidth: "100%",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.caption || "Observation Frame"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Symmetrical Two-Line Header with Clean Glass Pill */}
          <div
            className="container gallery-hero-headings-box"
            style={{
              position: "relative",
              zIndex: 2,
              textAlign: "center",
              maxWidth: "960px",
              padding: "0.5rem 1.5rem",
              marginTop: arch && arch.overlap ? -arch.overlap : "1.5rem",
            }}
          >
            <div className="hero-glass-pill">ANTARIKSH ARCHIVES</div>

            <h1 className="editorial-headline">
              <span className="line-1">WE SAW THE COSMOS</span>
              <span className="line-2">& obviously, we took photos.</span>
            </h1>
          </div>
        </section>

        {/* 2. Scrapbook, Filters & Grid */}
        <section id="moments" className="gallery-page-content">
          <div className="container">
            <div className="gallery-page-heading">
              <div>
                <h2>
                  Our <em>cosmic</em>
                  <br />
                  scrapbook.
                </h2>
              </div>
              <button
                className="apod-card"
                id="apod-card"
                type="button"
                aria-haspopup="dialog"
                onClick={() => setIsApodModalOpen(true)}
              >
                <img
                  id="apod-thumb"
                  src={
                    apodData.media_type === "video"
                      ? apodData.thumbnail_url
                      : apodData.url
                  }
                  alt="NASA Astronomy Picture of the Day"
                />
                <span>
                  <b>ASTRONOMY PICTURE OF THE DAY</b>
                  <strong id="apod-card-title">{apodData.title}</strong>
                  <p className="apod-click-info">CLICK FOR MORE INFO ↗</p>
                </span>
              </button>
            </div>

            <div className="gallery-controls" aria-label="Gallery controls">
              <div className="filter-container">
                <div
                  className="desktop-filters"
                  style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}
                >
                  {[
                    "all",
                    "star-party",
                    "workshops",
                    "internal-talks",
                    "outreachs",
                  ].map((f) => (
                    <button
                      key={f}
                      onClick={() => setSelectedFilter(f)}
                      style={{
                        padding: "4px 16px",
                        borderRadius: "999px",
                        cursor: "pointer",
                        background:
                          selectedFilter === f
                            ? "rgba(255, 255, 255, 0.2)"
                            : "rgba(255, 255, 255, 0.05)",
                        backdropFilter: "blur(12px)",
                        border: `1px solid rgba(255, 255, 255, ${selectedFilter === f ? "0.5" : "0.15"})`,
                        color:
                          selectedFilter === f
                            ? "#fff"
                            : "var(--text-dim, #aebfd1)",
                        boxShadow:
                          selectedFilter === f
                            ? "0 4px 15px rgba(255, 255, 255, 0.1)"
                            : "none",
                        transition: "all 0.25s ease",
                        fontFamily: '"DM Mono", monospace',
                        fontSize: "0.7rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {f === "all"
                        ? "All events"
                        : f
                            .split("-")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ")}
                    </button>
                  ))}
                </div>

                <div
                  className="mobile-filters"
                  style={{ position: "relative", zIndex: 10, width: "100%" }}
                >
                  <button
                    onClick={() =>
                      setIsFilterDropdownOpen(!isFilterDropdownOpen)
                    }
                    style={{
                      width: "100%",
                      padding: "12px 20px",
                      background: "rgba(255, 255, 255, 0.08)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      color: "#fff",
                      borderRadius: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.75rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      fontFamily: '"DM Mono", monospace',
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span>
                        {selectedFilter === "all"
                          ? "All events"
                          : selectedFilter
                              .split("-")
                              .map(
                                (w) => w.charAt(0).toUpperCase() + w.slice(1),
                              )
                              .join(" ")}
                      </span>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{
                        transform: isFilterDropdownOpen
                          ? "rotate(180deg)"
                          : "none",
                        transition: "transform 0.2s",
                      }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {isFilterDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: "8px",
                        background: "rgba(9, 9, 27, 0.98)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "8px",
                        overflow: "hidden",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                      }}
                    >
                      {[
                        "all",
                        "star-party",
                        "workshops",
                        "internal-talks",
                        "outreachs",
                      ].map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setSelectedFilter(f);
                            setIsFilterDropdownOpen(false);
                          }}
                          style={{
                            width: "100%",
                            padding: "12px 20px",
                            textAlign: "left",
                            background:
                              selectedFilter === f
                                ? "rgba(255,255,255,0.1)"
                                : "transparent",
                            border: "none",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            color:
                              selectedFilter === f
                                ? "#fff"
                                : "var(--text-dim, #aebfd1)",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "0.75rem",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                            fontFamily: '"DM Mono", monospace',
                          }}
                        >
                          {f === "all"
                            ? "All events"
                            : f
                                .split("-")
                                .map(
                                  (w) => w.charAt(0).toUpperCase() + w.slice(1),
                                )
                                .join(" ")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <a
                className="astro-jump"
                href="#astrophotography"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "4px 16px",
                  fontFamily: '"DM Mono", monospace',
                  fontSize: "0.7rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                View astrophotography <b style={{ marginLeft: "4px" }}>↓</b>
              </a>
            </div>

            <div className="gallery-line">
              <span>
                {selectedFilter === "all"
                  ? "SCROLL TO REVEAL"
                  : `${selectedFilter.toUpperCase()} MOMENTS`}
              </span>
              <span>
                {filteredMemories.length} MOMENT
                {filteredMemories.length === 1 ? "" : "S"} CAPTURED
              </span>
            </div>

            <div id="event-grid" className="event-grid">
              {filteredMemories.map((item, idx) => (
                <article
                  key={item.id || idx}
                  className="event-tile in-view"
                  data-event-type={item.category}
                  style={{ transitionDelay: `${(idx % 4) * 80}ms` }}
                >
                  <img
                    src={item.mediaImageUrl}
                    alt={item.caption}
                    loading="lazy"
                  />
                  <div className="tile-caption" style={{ opacity: 1 }}>
                    <strong>{item.caption}</strong>
                    <span>{formatDate(item.takenDate)}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Astrophotography Section */}
        <section id="astrophotography" className="astrophotography-section">
          <div className="container">
            <div className="gallery-page-heading">
              <div>
                <p className="kicker">THROUGH OUR LENSES</p>
                <h2>
                  Astrophoto
                  <br />
                  <em>archive.</em>
                </h2>
              </div>
            </div>
            <div className="gallery-line">
              <span>CLUB CAPTURES</span>
              <span>6 PLACEHOLDER FRAMES</span>
            </div>
            <div id="astro-grid" className="event-grid astro-grid">
              {astroPhotos.map((photo, idx) => (
                <article
                  key={photo.id || idx}
                  className="event-tile in-view"
                  style={{ transitionDelay: `${(idx % 4) * 80}ms` }}
                >
                  <img
                    src={photo.mediaImageUrl}
                    alt={photo.caption}
                    loading="lazy"
                  />
                  <div className="tile-caption" style={{ opacity: 1 }}>
                    <strong>{photo.caption}</strong>
                    <span>{photo.tagline}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* APOD Modal */}
      {isApodModalOpen && (
        <div
          className="apod-modal open"
          id="apod-modal"
          onClick={() => setIsApodModalOpen(false)}
        >
          <article
            className="apod-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="apod-close"
              type="button"
              aria-label="Close Astronomy Picture of the Day"
              onClick={() => setIsApodModalOpen(false)}
            >
              ×
            </button>
            <div className="apod-image">
              <img
                id="apod-image"
                src={
                  apodData.media_type === "video"
                    ? apodData.thumbnail_url
                    : apodData.url
                }
                alt="NASA Astronomy Picture of the Day"
              />
            </div>
            <div className="apod-copy">
              <p>NASA / ASTRONOMY PICTURE OF THE DAY</p>
              <h2>{apodData.title}</h2>
              <time>{apodData.date}</time>
              <p>{apodData.explanation}</p>
              <a
                id="apod-link"
                href={getApodPageUrl(apodData)}
                target="_blank"
                rel="noopener noreferrer"
              >
                READ ON NASA APOD ↗
              </a>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
