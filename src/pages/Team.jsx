import React, { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { supabase } from "../lib/supabaseClient";

export default function Team() {
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pure Dragging Engine Ref
  const marqueeTrackRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentTranslateRef = useRef(0);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const resumeTimerRef = useRef(null);
  const [isInteracting, setIsInteracting] = useState(false);

  // Ref to track modal open state inside requestAnimationFrame without re-triggering effect
  const isModalOpenRef = useRef(false);

  useEffect(() => {
    isModalOpenRef.current = !!selectedMember;
  }, [selectedMember]);

  useEffect(() => {
    async function fetchActiveCrew() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("Member")
          .select("*")
          .eq("isAlumni", false)
          .order("displayOrder", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true });

        if (error) {
          console.error("Error fetching crew from Supabase:", error);
        } else if (data) {
          const sorted = [...data].sort((a, b) => {
            const orderA =
              a.displayOrder !== null && a.displayOrder !== undefined
                ? Number(a.displayOrder)
                : Infinity;
            const orderB =
              b.displayOrder !== null && b.displayOrder !== undefined
                ? Number(b.displayOrder)
                : Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return (a.name || "").localeCompare(b.name || "");
          });
          setMembers(sorted);
        }
      } catch (err) {
        console.error("Failed to query Member table:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchActiveCrew();
  }, [supabase]);

  const FALLBACK_AVATAR =
    "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1000&q=80";

  // Helper to extract multiple domains whether it's an Array or delimited string
  const parseDomains = (member) => {
    let raw = member?.domain || member?.domains;
    if (!raw) return [];
    if (Array.isArray(raw)) raw = raw.join(",");
    return String(raw)
      .replace(/[{}[\]"']/g, "")
      .split(/[,/|]/)
      .map((d) => d.trim())
      .filter(Boolean);
  };

  const isVolunteer = (m) => {
    const role = (m.role || "").toLowerCase();
    const desig = (m.designation || "").toLowerCase();
    return role.includes("volunteer") || desig.includes("volunteer");
  };

  const volunteers = members.filter(isVolunteer);
  const coreMembers = members.filter((m) => !isVolunteer(m));

  const mentors = coreMembers.filter((m) => {
    const role = (m.role || "").toUpperCase();
    const dept = (m.department || "").toLowerCase();
    const desig = (m.designation || "").toLowerCase();
    return (
      role === "MENTOR" ||
      dept.includes("faculty") ||
      desig.includes("mentor") ||
      desig.includes("advisor")
    );
  });

  const president = coreMembers.find((m) => {
    const desig = (m.designation || "").toLowerCase();
    const role = (m.role || "").toUpperCase();
    return (
      m.academicYear === "TY" &&
      (desig.includes("president") ||
        desig.includes("lead") ||
        role === "ADMIN") &&
      !mentors.some((mentor) => mentor.id === m.id)
    );
  });

  const leadership = [
    ...mentors.slice(0, 3),
    ...(president ? [president] : []),
  ];

  const tyCrew = coreMembers.filter(
    (m) =>
      m.academicYear === "TY" &&
      (!president || m.id !== president.id) &&
      !mentors.some((mentor) => mentor.id === m.id),
  );

  const syCrew = coreMembers.filter(
    (m) =>
      m.academicYear === "SY" && !mentors.some((mentor) => mentor.id === m.id),
  );

  // All core members in intentional hierarchy
  const displayList = [...leadership, ...tyCrew, ...syCrew];

  // Single-Volunteer Support:
  // If only 1-4 volunteers exist, repeat to fill the screen width (minimum 8 cards per set)
  const baseVolunteersSet = (() => {
    if (volunteers.length === 0) return [];
    let set = [...volunteers];
    while (set.length < 8) {
      set = [...set, ...volunteers];
    }
    return set;
  })();

  // Exactly Set A + Set B (scrollWidth / 2 is mathematically exact to 1 Set)
  const marqueeItems = [...baseVolunteersSet, ...baseVolunteersSet];

  const rotations = [-4, 3, -2, 5, -3, 4, -5, 2];
  const verticalOffsets = [14, 0, 8, -4, 12, 2, -6, 10];

  // Continuous JS loop: Exact 50% Euclidean wrap
  useEffect(() => {
    if (marqueeItems.length === 0) return;

    const SPEED = 0.045; // px per ms

    const tick = (time) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (marqueeTrackRef.current) {
        // One complete set width = half of the duplicated track
        const setWidth = marqueeTrackRef.current.scrollWidth / 2;

        if (setWidth > 0) {
          if (!isDraggingRef.current && !isModalOpenRef.current) {
            currentTranslateRef.current -= SPEED * delta;
          }

          // Mathematical modulo wrap in range [-setWidth, 0)
          currentTranslateRef.current =
            ((currentTranslateRef.current % setWidth) - setWidth) % setWidth;

          marqueeTrackRef.current.style.transform = `translate3d(${currentTranslateRef.current}px, 0, 0)`;
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [marqueeItems.length]);

  // Pointer drag events (mouse & touch)
  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    setIsInteracting(true);
    startXRef.current = e.clientX || (e.touches && e.touches[0].clientX);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || !marqueeTrackRef.current) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const deltaX = clientX - startXRef.current;
    startXRef.current = clientX;

    currentTranslateRef.current += deltaX;

    const setWidth = marqueeTrackRef.current.scrollWidth / 2;
    if (setWidth > 0) {
      currentTranslateRef.current =
        ((currentTranslateRef.current % setWidth) - setWidth) % setWidth;
    }

    marqueeTrackRef.current.style.transform = `translate3d(${currentTranslateRef.current}px, 0, 0)`;
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    resumeTimerRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 1500);
  };

  return (
    <div className="crew-page">
      <video
        className="site-galaxy-background"
        autoPlay
        muted
        playsInline
        loop
        preload="metadata"
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -2,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      >
        <source src="/static/assets/galaxy_small.mp4" type="video/mp4" />
      </video>
      <div
        className="site-galaxy-veil"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      ></div>
      <div className="noise"></div>

      <Navbar />

      <main
        className="crew-main"
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "85vh",
          paddingBottom: "5rem",
        }}
      >
        {/* Full Viewport Landing Hero Header */}
        <section
          className="crew-hero"
          style={{
            height: "calc(100vh - 80px)",
            minHeight: "560px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 1.5rem",
            position: "relative",
            boxSizing: "border-box",
          }}
        >
          <div className="container" style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 1rem" }}>
            <p className="crew-kicker" style={{ marginBottom: "16px", textAlign: "center" }}>
              04 / MEET MEMBERS
            </p>
            <h1
              style={{
                textAlign: "center",
                margin: "0 auto",
                fontSize: "clamp(1.75rem, 4.6vw, 4.8rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.035em",
                maxWidth: "100%",
              }}
            >
              <span style={{ display: "block", whiteSpace: "nowrap" }}>
                The Minds Behind the Craft
              </span>
              <em
                style={{
                  display: "block",
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: "#d8b4fe",
                  marginTop: "0.35rem",
                  whiteSpace: "nowrap",
                }}
              >
                — Team Antariksh.
              </em>
            </h1>
            <p
              className="crew-intro"
              style={{
                margin: "24px auto 0 auto",
                textAlign: "center",
                maxWidth: "500px",
                fontSize: "0.82rem",
                fontWeight: 300,
                lineHeight: 1.6,
                color: "#94a3b8",
                letterSpacing: "0.02em",
              }}
            >
              The astronomers, engineers, and researchers steering Antariksh forward into deep space exploration.
            </p>
          </div>

          {/* Minimalist Vertical Hairline Scroll Indicator */}
          <a
            href="#crew-manifest"
            aria-label="Scroll down to crew manifest"
            style={{
              position: "absolute",
              bottom: "2rem",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.25em",
                color: "rgba(255, 255, 255, 0.4)",
                textTransform: "uppercase",
              }}
            >
              SCROLL
            </span>
            <div
              style={{
                width: "1px",
                height: "40px",
                background: "linear-gradient(to bottom, rgba(168, 85, 247, 0.6), rgba(255, 255, 255, 0.08))",
                position: "relative",
                overflow: "hidden",
                borderRadius: "1px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "50%",
                  background: "linear-gradient(to bottom, transparent, #c084fc, transparent)",
                  animation: "hairlineSlide 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
              />
            </div>
          </a>
        </section>

        {/* Core Crew Grid - 260px Card Width & 5rem Row Gap */}
        <section id="crew-manifest" style={{ paddingTop: "2rem" }}>
          <div
            className="container"
            style={{
              maxWidth: "1240px",
              margin: "0 auto",
              padding: "0 1.5rem",
            }}
          >
            {isLoading ? (
              <div
                style={{
                  padding: "6rem 0",
                  textAlign: "center",
                  fontFamily: "monospace",
                  color: "#a1a1aa",
                  letterSpacing: "0.1em",
                }}
              >
                LOADING CREW DIRECTORY...
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  rowGap: "5rem",
                  columnGap: "2rem",
                  paddingTop: "1rem",
                }}
              >
                {displayList.map((member) => (
                  <div
                    key={member.id || member.slug}
                    onClick={() => setSelectedMember(member)}
                    style={{
                      position: "relative",
                      width: "260px",
                      flex: "0 1 260px",
                      background:
                        "linear-gradient(180deg, rgba(18, 22, 35, 0.78) 0%, rgba(9, 11, 19, 0.96) 100%)",
                      backdropFilter: "blur(20px)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "14px",
                      padding: "3.8rem 1.25rem 1.25rem 1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      boxShadow:
                        "0 14px 28px -10px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                      transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(168, 85, 247, 0.45)";
                      }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor =
                        "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.boxShadow =
                        "0 14px 28px -10px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.08)";
                    }}
                  >
                    {/* Avatar Frame: 88px with 5px radius */}
                    <div
                      style={{
                        position: "absolute",
                        top: "-44px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "88px",
                        height: "88px",
                        borderRadius: "5px",
                        padding: "2px",
                        background:
                          "linear-gradient(135deg, rgba(168, 85, 247, 0.8), rgba(59, 130, 246, 0.4))",
                        boxShadow:
                          "0 10px 24px rgba(0, 0, 0, 0.85), 0 0 15px rgba(168, 85, 247, 0.25)",
                      }}
                    >
                      <img
                        src={member.avatarImageUrl || FALLBACK_AVATAR}
                        alt={member.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "5px",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>

                    {/* Member Name */}
                    <h3
                      style={{
                        fontSize: "1.12rem",
                        fontWeight: 600,
                        color: "#f8fafc",
                        margin: "0 0 0.25rem 0",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {member.name}
                    </h3>

                    {/* Designation Only */}
                    <p
                      style={{
                        fontSize: "0.85rem",
                        color: "#a78bfa",
                        margin: 0,
                        lineHeight: 1.35,
                        fontFamily: "monospace",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        fontWeight: 500,
                      }}
                    >
                      {member.designation || member.role || member.department}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Hanging Infinite Volunteers Marquee */}
        {volunteers.length > 0 && (
          <section
            style={{
              position: "relative",
              marginTop: "6rem",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                textAlign: "center",
                marginBottom: "1.5rem",
                padding: "0 1.5rem",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.2em",
                  color: "#c7b5ff",
                  background: "rgba(167, 139, 250, 0.22)",
                  border: "1px solid rgba(167, 139, 250, 0.25)",
                  padding: "2px 10px",
                  borderRadius: "999px",
                  marginBottom: "0.75rem",
                  textTransform: "uppercase",
                }}
              >
                TEAM ANTARIKSH
              </span>
              <h2
                style={{
                  fontSize: "clamp(2rem, 4vw, 2.75rem)",
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                Active Astrophiles
              </h2>
              <p
                style={{
                  color: "#a1a1aa",
                  fontSize: "0.9rem",
                  maxWidth: "520px",
                  margin: "0.5rem auto 1.5rem auto",
                }}
              >
                The team behind turning quiet midnight skies and curious minds
                into unforgettable encounters with the cosmos.
              </p>
            </div>

            {/* Marquee Outer Box */}
            <div
              style={{
                position: "relative",
                width: "100%",
                overflow: "hidden",
                userSelect: "none",
              }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            >
              {/* Curved Cable Wire SVG (BEHIND CARDS: zIndex: 0) */}
              <div
                style={{
                  position: "absolute",
                  top: "58px",
                  left: 0,
                  right: 0,
                  height: "100px",
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 1440 100"
                  preserveAspectRatio="none"
                  fill="none"
                >
                  <path
                    d="M0,30 Q360,75 720,75 T1440,30"
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                </svg>
              </div>

              {/* Edge Gradient Masks */}
              <div
                style={{
                  position: "absolute",
                  insetBlock: 0,
                  left: 0,
                  width: "120px",
                  background: "linear-gradient(to right, #05070f, transparent)",
                  zIndex: 10,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  insetBlock: 0,
                  right: 0,
                  width: "120px",
                  background: "linear-gradient(to left, #05070f, transparent)",
                  zIndex: 10,
                  pointerEvents: "none",
                }}
              />

              {/* Continuous Ribbon driven by JS */}
              <div
                ref={marqueeTrackRef}
                style={{
                  display: "flex",
                  gap: "3.25rem",
                  width: "max-content",
                  paddingTop: "48px",
                  paddingBottom: "35px",
                  cursor: isInteracting ? "grabbing" : "grab",
                  position: "relative",
                  zIndex: 2,
                  willChange: "transform",
                }}
              >
                {marqueeItems.map((vol, idx) => {
                  const rot = rotations[idx % rotations.length];
                  const offsetY = verticalOffsets[idx % verticalOffsets.length];

                  return (
                    <div
                      key={`${vol.id || idx}-${idx}`}
                      onClick={() => {
                        if (!isDraggingRef.current) setSelectedMember(vol);
                      }}
                      style={{
                        position: "relative",
                        width: "215px",
                        flexShrink: 0,
                        transform: `translateY(${offsetY}px) rotate(${rot}deg)`,
                        transition: "transform 0.25s ease, z-index 0.2s",
                        zIndex: 2,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = `translateY(${Math.max(offsetY - 8, -6)}px) rotate(0deg) scale(1.05)`;
                        e.currentTarget.style.zIndex = "8";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = `translateY(${offsetY}px) rotate(${rot}deg) scale(1)`;
                        e.currentTarget.style.zIndex = "2";
                      }}
                    >
                      {/* Green Pin Clip */}
                      <div
                        style={{
                          position: "absolute",
                          top: "-18px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: "18px",
                          height: "24px",
                          background: "#22c55e",
                          borderRadius: "3px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                          zIndex: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "#ffffff",
                            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
                          }}
                        />
                      </div>

                      {/* Polaroid Card */}
                      <div
                        style={{
                          background: "rgba(255, 255, 255, 0.95)",
                          borderRadius: "5px",
                          padding: "10px 10px 14px 10px",
                          boxShadow: "0 14px 28px rgba(0, 0, 0, 0.45)",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: "190px",
                            borderRadius: "5px",
                            overflow: "hidden",
                            background: "#090d16",
                            marginBottom: "10px",
                          }}
                        >
                          <img
                            src={vol.avatarImageUrl || FALLBACK_AVATAR}
                            alt={vol.name}
                            draggable="false"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                              userSelect: "none",
                            }}
                          />
                        </div>

                        <div style={{ textAlign: "left", padding: "0 4px" }}>
                          <h3
                            style={{
                              fontSize: "0.92rem",
                              fontWeight: 700,
                              color: "#0f172a",
                              margin: "0 0 2px 0",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {vol.name}
                          </h3>
                          <p
                            style={{
                              fontSize: "0.72rem",
                              color: "#64748b",
                              margin: 0,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {vol.designation ||
                              vol.role ||
                              vol.department ||
                              "Volunteer"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />

      {/* Member Details Modal */}
      {selectedMember && (
        <div
          className="crew-modal-backdrop"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="crew-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(11, 13, 21, 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "16px",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.85), 0 0 30px rgba(168, 85, 247, 0.12)",
              width: "100%",
              maxWidth: "620px",
              padding: "1.75rem",
              position: "relative",
              display: "flex",
              flexDirection: "row",
              gap: "1.5rem",
              alignItems: "stretch",
            }}
          >
            <button
              className="crew-modal-close"
              onClick={() => setSelectedMember(null)}
              aria-label="Close details"
              style={{
                position: "absolute",
                top: "12px",
                right: "14px",
                zIndex: 10,
              }}
            >
              ×
            </button>

            {/* Left Column: 40% Square Image */}
            <div
              style={{
                width: "40%",
                flexShrink: 0,
                aspectRatio: "1 / 1",
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6), 0 0 15px rgba(168, 85, 247, 0.2)",
                background: "#080a12",
              }}
            >
              <img
                src={selectedMember.avatarImageUrl || FALLBACK_AVATAR}
                alt={selectedMember.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>

            {/* Right Column: 60% Details */}
            <div
              style={{
                width: "60%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                minWidth: 0,
                paddingRight: "0.5rem",
              }}
            >
              <div style={{ marginBottom: "0.35rem" }}>
                <span
                  style={{
                    background: "rgba(168, 85, 247, 0.15)",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                    color: "#d8b4fe",
                    padding: "2px 8px",
                    borderRadius: "99px",
                    fontSize: "0.7rem",
                    fontFamily: "monospace",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {selectedMember.role || "MEMBER"}
                </span>
              </div>

              <h2
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  margin: "0 0 0.25rem 0",
                  color: "#ffffff",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.25,
                }}
              >
                {selectedMember.name}
              </h2>

              <p style={{ color: "#94a3b8", fontSize: "0.82rem", margin: 0, fontFamily: "monospace" }}>
                {[selectedMember.department, selectedMember.academicYear]
                  .filter(Boolean)
                  .join(" • ")}
              </p>

              {/* Multiple Domains without curly brackets */}
              {parseDomains(selectedMember).length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.35rem",
                    marginTop: "0.5rem",
                  }}
                >
                  {parseDomains(selectedMember).map((dom, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: "0.68rem",
                        fontFamily: "monospace",
                        color: "#d8b4fe",
                        background: "rgba(168, 85, 247, 0.15)",
                        border: "1px solid rgba(168, 85, 247, 0.3)",
                        padding: "2px 7px",
                        borderRadius: "4px",
                      }}
                    >
                      {dom}
                    </span>
                  ))}
                </div>
              )}

              {selectedMember.bio && (
                <p
                  style={{
                    color: "#d4d4d8",
                    fontSize: "0.85rem",
                    lineHeight: 1.5,
                    marginTop: "0.6rem",
                    marginBottom: 0,
                  }}
                >
                  {selectedMember.bio}
                </p>
              )}

              {(selectedMember.linkedinUrl ||
                selectedMember.githubUrl ||
                selectedMember.instagramUrl) && (
                <div
                  className="crew-modal-socials"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginTop: "0.85rem",
                  }}
                >
                  {selectedMember.linkedinUrl && (
                    <a
                      href={selectedMember.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="crew-social-btn"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.75a1.48 1.48 0 1 0 0 2.96 1.48 1.48 0 0 0 0-2.96Z" />
                      </svg>
                      LinkedIn
                    </a>
                  )}
                  {selectedMember.githubUrl && (
                    <a
                      href={selectedMember.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="crew-social-btn"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z" />
                      </svg>
                      GitHub
                    </a>
                  )}
                  {selectedMember.instagramUrl && (
                    <a
                      href={selectedMember.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="crew-social-btn"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                      Instagram
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
