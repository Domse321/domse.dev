        import React, { useState, useEffect, useRef } from 'react';
        import { createRoot } from 'react-dom/client';
        import { Play, Terminal, User, Mail, Github, Youtube, Twitch, ExternalLink, ChevronDown, Menu, X, Gamepad2, Clapperboard, Clock, Trophy, Sparkles, Loader2, Bot, MessageSquare, Send, Radio, AlertCircle, CheckCircle2 } from 'lucide-react';
        import './index.css';

        // --- GEMINI API CONFIGURATION ---
        // API key is kept server-side. Frontend calls the local proxy.

        const callGemini = async (prompt, systemInstruction = "") => {
          try {
            const response = await fetch('/api/gemini', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, systemInstruction }),
            });

            if (!response.ok) throw new Error('API Call failed');
            const data = await response.json();
            return data.text || "Konnte keine Antwort generieren.";
          } catch (error) {
            console.error("Gemini Error:", error);
            return "Fehler bei der Verbindung zur KI Matrix. Versuch es später nochmal.";
          }
        };

        // --- Components ---

        // Toast Notification System
        const Toast = ({ message, type = 'success', onClose }) => {
            useEffect(() => {
                const timer = setTimeout(onClose, 3000);
                return () => clearTimeout(timer);
            }, [onClose]);

            return (
                <div className="fixed bottom-8 right-8 z-50 animate-fadeIn pointer-events-none">
                    <div className={`pointer-events-auto flex items-center gap-3 px-6 py-3 rounded-lg shadow-xl border ${type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200' : 'bg-red-900/90 border-red-500/50 text-red-200'}`}>
                        {type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <span className="font-mono text-sm font-bold">{message}</span>
                    </div>
                </div>
            );
        };

        // Scroll Reveal Animation Wrapper
        const RevealOnScroll = ({ children, delay = 0 }) => {
          const [isVisible, setIsVisible] = useState(false);
          const ref = useRef(null);

          useEffect(() => {
            const observer = new IntersectionObserver(
              ([entry]) => {
                if (entry.isIntersecting) {
                  setIsVisible(true);
                  observer.unobserve(entry.target);
                }
              },
              { threshold: 0.1 }
            );
            if (ref.current) observer.observe(ref.current);
            return () => {
              if (ref.current) observer.unobserve(ref.current); 
            };
          }, []);

          const delayClass = {
            0: '',
            100: 'delay-100',
            150: 'delay-[150ms]',
            200: 'delay-200',
            300: 'delay-300',
            400: 'delay-[400ms]',
            500: 'delay-500',
            600: 'delay-[600ms]',
            700: 'delay-700',
            800: 'delay-[800ms]',
          }[delay] || '';

          return (
            <div
              ref={ref}
              className={`transition-all duration-1000 transform ${delayClass} ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              {children}
            </div>
          );
        };

        // Steam Profile Component
        const SteamProfile = ({ addToast }) => {
          const [challenge, setChallenge] = useState("");
          const [loading, setLoading] = useState(false);

          const generateChallenge = async () => {
            if (loading) return;
            setLoading(true);
            setChallenge("");
            
            const gamesForChallenge = "Arc Raiders, Rust, Rocket League, League of Legends (LoL), Teamfight Tactics (TFT), Valorant";
            const prompt = `Wähle ZUFÄLLIG genau EINES der folgenden Spiele aus: ${gamesForChallenge}. Generiere dann eine kurze, knackige Challenge NUR für dieses eine ausgewählte Spiel. Nenne das Spiel zuerst. Format: "[Spiel]: [Challenge]".`;
            
            const result = await callGemini(prompt, "Du bist ein sadistischer Game-Master. Du gibst immer nur genau eine Aufgabe für ein einziges Spiel.");
            
            setChallenge(result);
            setLoading(false);
            
            if (!result.includes("API Key")) {
                addToast("Neue Challenge generiert!", "success");
            } else {
                addToast("API Key fehlt!", "error");
            }
          };

          return (
            <div className="w-full max-w-4xl mx-auto bg-[#171a21] rounded-lg overflow-hidden shadow-2xl border border-[#2a475e] font-sans relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1b2838] to-[#171a21] z-0"></div>
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#66c0f4] opacity-5 blur-[100px] rounded-full"></div>

              <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start">
                
                {/* Avatar Column */}
                <div className="flex flex-col items-center space-y-4 w-full md:w-auto">
                  <div className="relative group/avatar">
                    <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-b from-[#57cbde] to-[#2a475e] p-[2px] rounded-none shadow-lg overflow-hidden">
                        <img 
                          src="./ppsteam.GIF" 
                          onError={(e) => {
                            e.target.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=Domse321&backgroundColor=171a21";
                            e.target.alt = "Placeholder Avatar";
                          }}
                          alt="Domse321 Avatar" 
                          className="w-full h-full bg-[#171a21] object-cover transition-transform duration-500 group-hover/avatar:scale-110" 
                        />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-[#171a21] p-1 rounded-full">
                       <div className="flex items-center gap-2 border border-[#57cbde] bg-[#1b2838] px-2 py-1 shadow-[0_0_10px_rgba(87,203,222,0.2)]">
                          <span className="relative flex h-2 w-2">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#57cbde] opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-2 w-2 bg-[#57cbde]"></span>
                          </span>
                          <span className="text-xs font-bold text-[#57cbde]">ONLINE</span>
                       </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-2xl text-white font-light tracking-wide">Domse321</h3>
                    <div className="text-[#66c0f4] text-xs mt-1 flex items-center justify-center gap-1">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png" className="w-3 h-3 opacity-70" alt="steam" />
                        STEAM USER
                    </div>
                  </div>
                </div>

                {/* Info Column */}
                <div className="flex-grow w-full">
                  <div className="flex justify-between items-center border-b border-[#2a475e] pb-4 mb-6">
                      <div>
                         <div className="text-white text-lg font-medium mb-1">Level <span className="inline-block w-8 h-8 leading-8 text-center rounded-full border border-[#ffcc00] text-[#ffcc00] text-sm font-bold ml-1">38</span></div>
                         <div className="text-[#8f98a0] text-sm">Community Member</div>
                      </div>
                      <div className="flex gap-4">
                         <div className="text-right">
                            <div className="text-white font-bold text-lg">89</div>
                            <div className="text-[#8f98a0] text-xs uppercase tracking-wider">Games</div>
                         </div>
                         <div className="text-right">
                            <div className="text-white font-bold text-lg">12</div>
                            <div className="text-[#8f98a0] text-xs uppercase tracking-wider">Badges</div>
                         </div>
                      </div>
                  </div>

                  <div>
                    <h4 className="text-[#c6d4df] text-sm font-bold mb-3 uppercase tracking-widest opacity-70">Recently Played</h4>
                    <div className="space-y-3">
                      
                      {/* Rust */}
                      <div className="bg-[#1b2838]/50 p-3 flex items-center gap-4 hover:bg-[#2a475e]/40 transition-colors cursor-default group/game border-l-2 border-transparent hover:border-[#57cbde]">
                         <div className="w-24 h-10 bg-slate-700 overflow-hidden relative shadow-md">
                            <img src="./rust.jpg" onError={(e) => e.target.src = "https://placehold.co/600x400/1e293b/cbd5e1?text=Rust"} alt="Rust" className="w-full h-full object-cover opacity-90 group-hover/game:opacity-100 transition-opacity" />
                         </div>
                         <div className="flex-grow">
                            <div className="text-[#c6d4df] font-bold group-hover/game:text-white transition-colors">Rust</div>
                            <div className="text-[#5ca33a] text-xs flex items-center gap-1">
                              <Clock size={10} /> 12.4 Std. letzte 2 Wochen
                            </div>
                         </div>
                         <div className="text-[#8f98a0] text-xs hidden sm:block">
                            1,857 Std. gesamt
                         </div>
                      </div>

                      {/* Arc Raiders */}
                      <div className="bg-[#1b2838]/50 p-3 flex items-center gap-4 hover:bg-[#2a475e]/40 transition-colors cursor-default group/game border-l-2 border-transparent hover:border-[#57cbde]">
                         <div className="w-24 h-10 bg-slate-700 overflow-hidden relative shadow-md">
                            <img src="./arcraiders.jpeg" onError={(e) => e.target.src = "https://placehold.co/600x400/1e293b/cbd5e1?text=Arc+Raiders"} alt="Arc Raiders" className="w-full h-full object-cover opacity-90 group-hover/game:opacity-100 transition-opacity" />
                         </div>
                         <div className="flex-grow">
                            <div className="text-[#c6d4df] font-bold group-hover/game:text-white transition-colors">Arc Raiders</div>
                            <div className="text-[#8f98a0] text-xs flex items-center gap-1">
                              <Clock size={10} /> 66.2 Std. letzte 2 Wochen
                            </div>
                         </div>
                         <div className="text-[#8f98a0] text-xs hidden sm:block">
                            121 Std. gesamt
                         </div>
                      </div>

                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#2a475e]">
                      <div className="bg-[#000000]/30 rounded p-4 border border-[#57cbde]/20">
                         <div className="flex justify-between items-center mb-2">
                           <h5 className="text-[#57cbde] text-sm font-bold flex items-center gap-2">
                             <Bot size={16} /> AI GAME MASTER
                           </h5>
                           <button 
                             onClick={generateChallenge}
                             disabled={loading}
                             className="text-xs bg-[#57cbde] text-[#171a21] px-3 py-1 rounded font-bold hover:bg-white transition-colors flex items-center gap-1 disabled:opacity-50"
                           >
                             {loading ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                             {loading ? "Würfle..." : "GIB MIR EINE CHALLENGE"}
                           </button>
                         </div>
                         <div className="text-gray-300 text-sm min-h-[20px] italic">
                           {challenge ? (
                             <span className="animate-pulse text-[#c6d4df]">{challenge}</span>
                           ) : (
                             <span className="text-gray-500">Klicke den Button für eine zufällige Hardcore-Aufgabe für eines deiner Main-Games...</span>
                           )}
                         </div>
                      </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                      <a href="https://steamcommunity.com/id/Domse321/" target="_blank" rel="noreferrer" className="text-xs text-white bg-[#2a475e] hover:bg-[#66c0f4] hover:text-black px-4 py-2 rounded transition-colors font-bold flex items-center gap-2">
                        VIEW FULL PROFILE <ExternalLink size={12} />
                      </a>
                  </div>
                </div>
              </div>
            </div>
          );
        };

        // --- Main Portfolio Component ---
        const Portfolio = () => {
          const [isScrolled, setIsScrolled] = useState(false);
          const [isMenuOpen, setIsMenuOpen] = useState(false);
          const [analyses, setAnalyses] = useState({});
          const [analyzing, setAnalyzing] = useState(null); 
          const [toast, setToast] = useState(null);

          const showToast = (msg, type) => setToast({ message: msg, type });

          useEffect(() => {
            const handleScroll = () => {
              setIsScrolled(window.scrollY > 50);
            };
            window.addEventListener('scroll', handleScroll);
            return () => window.removeEventListener('scroll', handleScroll);
          }, []);

          const videos = [
            {
              id: 1,
              title: "The Script (Kurzfilm)",
              desc: "Ein ERS Spielfilm über Drehbücher und Zeitreisen. Wenn Fiktion zur Realität wird.",
              videoId: "i3xdJkqxBK8", 
              icon: <Clapperboard size={16} className="text-pink-500" />
            },
            {
              id: 2,
              title: "LetsHugo Manhunt Clutch",
              desc: "Der Moment der Wahrheit: Alle Perspektiven und Reactions zu einem legendären Survival-Play.",
              videoId: "SWRWhE2yYJs", 
              icon: <Gamepad2 size={16} className="text-purple-500" />
            },
            {
              id: 3,
              title: "Rust: Harbor Control",
              desc: "Vom Naked am Strand zur Kontrolle über den Hafen. Ein Wipe voller Action und Loot.",
              videoId: "6FRGj-8GBlE", 
              icon: <Gamepad2 size={16} className="text-purple-500" />
            }
          ];

          const projects = [
            {
              title: "Auto-Backup Script",
              category: "Automation",
              desc: "Python-Skript, das meine Projektordner nachts automatisch komprimiert und in die Cloud lädt.",
              tags: ["Python", "Boto3", "Cron"],
              color: "from-blue-600 to-indigo-600"
            },
            {
              title: "Discord Music Bot",
              category: "Community Tool",
              desc: "Ein kleiner Bot für meinen Server, der YouTube-Links in Warteschlangen abspielt.",
              tags: ["Node.js", "Discord.js", "FFmpeg"],
              color: "from-green-600 to-emerald-600"
            },
            {
              title: "Game Config Manager",
              category: "Gaming Utility",
              desc: "Bash-Tool zum schnellen Wechseln zwischen verschiedenen Config-Dateien für CS:GO.",
              tags: ["Bash", "Shell", "Linux"],
              color: "from-orange-500 to-red-500"
            }
          ];

          const analyzeStack = async (index, project) => {
            if (analyzing === index) return;
            setAnalyzing(index);
            
            const prompt = `Analysiere diesen Tech-Stack für das Projekt "${project.title}": ${project.tags.join(', ')}. Erklärung, warum diese Tools gut zusammenpassen. Halte es kurz, informell und technisch fundiert (für Entwickler). Sprache: Deutsch.`;
            const result = await callGemini(prompt, "Du bist ein erfahrener Senior Developer, der Tech-Stacks bewertet.");
            
            setAnalyses(prev => ({...prev, [index]: result}));
            setAnalyzing(null);
            
            if (!result.includes("API Key")) {
                showToast("Stack-Analyse abgeschlossen!", "success");
            }
          };

          return (
            <div className="min-h-screen bg-slate-950 text-white selection:bg-purple-500 selection:text-white overflow-x-hidden font-sans">
              
              {/* Toast Notification */}
              {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

              {/* Navbar */}
              {/* Navbar Fix: Added border-b explicitly to base class and control color via conditional. Removed border-bottom from glass-nav CSS */}
              <nav className={`fixed w-full z-50 transition-all duration-300 border-b ${isScrolled ? 'glass-nav py-4 border-white/5' : 'py-6 bg-transparent border-transparent'}`}>
                <div className="container mx-auto px-6 flex justify-between items-center">
                  
                  <a href="#home" className="flex items-center gap-3 group cursor-pointer z-50 relative">
                      <img 
                        src="./Titel.png" 
                        alt="Logo" 
                        className="w-10 h-10 object-contain group-hover:rotate-12 transition-transform duration-300"
                        onError={(e) => { e.currentTarget.hidden = true; }} 
                      />
                      <div className="flex flex-col">
                        <div className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 font-mono flex items-center gap-2 glitch-wrapper" data-text="EDIT & LOOT">
                          <span>EDIT & LOOT</span>
                          <span className="animate-pulse text-xs bg-purple-500/20 px-1 rounded text-purple-400 border border-purple-500/30 no-glitch">BETA</span>
                        </div>
                      </div>
                  </a>
                  
                  <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-300">
                    <a href="#home" className="hover:text-white hover:scale-105 transition-all">Intro</a>
                    <a href="#videos" className="hover:text-white hover:scale-105 transition-all">Content</a>
                    <a href="#steam" className="hover:text-white hover:scale-105 transition-all text-blue-400">Steam</a>
                    <a href="#scripts" className="hover:text-white hover:scale-105 transition-all">Skripte</a>
                    <a href="#me" className="hover:text-white hover:scale-105 transition-all">Über mich</a>
                  </div>

                  <div className="hidden md:flex gap-4">
                    <a href="https://youtube.com/@domse321?si=v1fHEhym9j43JawK" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-red-500 transition-colors transform hover:scale-110"><Youtube size={20} /></a>
                    <a href="https://twitch.tv/xdomse321x" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-purple-400 transition-colors transform hover:scale-110"><Twitch size={20} /></a>
                  </div>

                  <button className="md:hidden text-white z-50 relative" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                    {isMenuOpen ? <X /> : <Menu />}
                  </button>
                </div>

                {/* Mobile Menu Overlay */}
                <div className={`fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-40 flex flex-col items-center justify-center space-y-8 transition-transform duration-300 md:hidden ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    {["Intro", "Content", "Steam", "Skripte", "Über mich"].map((item) => (
                        <a key={item} href={`#${item === "Über mich" ? "me" : item === "Content" ? "videos" : item === "Intro" ? "home" : item.toLowerCase()}`} onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold text-slate-300 hover:text-white hover:scale-110 transition-all">{item}</a>
                    ))}
                </div>
              </nav>

              {/* HERO SECTION */}
              <section id="home" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden min-h-screen flex items-center justify-center">
                
                {/* Video Background with Darkening Overlay */}
                <div className="absolute inset-0 z-0">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover opacity-20"
                    >
                        <source src="./background.mp4" type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/80 to-slate-950"></div>
                </div>

                {/* Blobs */}
                <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob"></div>
                <div className="absolute top-20 right-0 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob animation-delay-2000"></div>

                <div className="container mx-auto text-center relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-semibold tracking-wider text-cyan-300 uppercase bg-cyan-900/20 rounded-full border border-cyan-500/20 animate-fadeIn backdrop-blur-sm">
                    <Gamepad2 size={14} /> Hobbyist & Creator
                  </div>
                  
                  <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6 animate-fadeIn delay-100">
                    Gaming, Edits <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-400 to-emerald-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                      & Code Snippets.
                    </span>
                  </h1>

                  <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-10 leading-relaxed animate-fadeIn delay-200">
                    Just pure creativity. Hier lade ich hoch, worauf ich Bock habe – 
                    ohne Filter, ohne Skript, einfach Content und Code.
                  </p>

                  <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fadeIn delay-300">
                    <a href="#videos" className="px-8 py-4 rounded-full bg-white text-slate-900 font-bold hover:bg-slate-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:-translate-y-1 flex items-center justify-center gap-2">
                      <Play size={18} fill="currentColor" /> Videos ansehen
                    </a>
                    <a href="#steam" className="px-8 py-4 rounded-full bg-[#171a21]/80 text-[#66c0f4] font-bold hover:bg-[#1b2838] transition-all border border-[#66c0f4]/30 hover:border-[#66c0f4] hover:shadow-[0_0_20px_rgba(102,192,244,0.3)] hover:-translate-y-1 flex items-center justify-center gap-2 backdrop-blur-sm">
                      <Gamepad2 size={18} /> Steam Status
                    </a>
                  </div>
                </div>

                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce text-slate-500 opacity-50">
                  <ChevronDown size={32} />
                </div>
              </section>

              {/* VIDEO SECTION */}
              <section id="videos" className="py-20 relative z-20">
                <div className="container mx-auto px-6">
                  <RevealOnScroll>
                    <div className="flex items-end justify-between mb-12 border-l-4 border-purple-500 pl-6">
                      <div>
                        <h2 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
                          <Clapperboard className="text-purple-400" /> Creative Works
                        </h2>
                        <p className="text-slate-400">Highlights, Kurzfilme & Gaming Moments.</p>
                      </div>
                    </div>
                  </RevealOnScroll>

                  <div className="grid md:grid-cols-3 gap-8">
                    {videos.map((video, index) => (
                      <RevealOnScroll key={video.id} delay={index * 200}>
                        <div className="group relative glass-card rounded-2xl overflow-hidden hover:-translate-y-2 transition-all duration-500 shadow-2xl border border-white/5 flex flex-col h-full hover:border-purple-500/30">
                          <div className="relative aspect-video bg-black">
                             <iframe 
                                loading="lazy"
                                width="100%" 
                                height="100%" 
                                src={`https://www.youtube.com/embed/${video.videoId}?rel=0&modestbranding=1`} 
                                title={video.title} 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                                className="opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                             ></iframe>
                          </div>
                          <div className="p-6 flex-grow flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="px-2 py-1 text-xs font-bold text-white bg-red-600 rounded flex items-center gap-1">
                                <Youtube size={12} /> YouTube
                              </span>
                              {video.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-2 group-hover:text-purple-400 transition-colors">{video.title}</h3>
                            <p className="text-slate-400 text-sm leading-relaxed flex-grow">{video.desc}</p>
                          </div>
                        </div>
                      </RevealOnScroll>
                    ))}
                  </div>
                </div>
              </section>

              {/* STEAM SECTION */}
              <section id="steam" className="py-20 bg-gradient-to-b from-slate-950 to-[#1b2838] relative border-t border-slate-800">
                  <div className="container mx-auto px-6 relative z-10">
                    <RevealOnScroll>
                      <div className="text-center mb-10">
                          <h2 className="text-3xl font-bold mb-2 flex items-center justify-center gap-3">
                             <Gamepad2 className="text-[#66c0f4]" size={32} /> Live Status
                          </h2>
                          <p className="text-slate-400">Aktuelle Stats & AI Challenges.</p>
                      </div>
                    </RevealOnScroll>
                    
                    <RevealOnScroll delay={200}>
                        <SteamProfile addToast={showToast} />
                    </RevealOnScroll>
                  </div>
              </section>

              {/* SCRIPTS SECTION */}
              <section id="scripts" className="py-20 bg-slate-900/50">
                <div className="container mx-auto px-6">
                  <RevealOnScroll>
                    <div className="text-center mb-12">
                      <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                        <Terminal className="text-emerald-400" /> Die "Nerd" Ecke
                      </h2>
                      <p className="text-slate-400 max-w-xl mx-auto">
                        Coding als Mittel zum Zweck. Hier sind ein paar kleine Tools und Skripte.
                      </p>
                    </div>
                  </RevealOnScroll>

                  <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6">
                    {projects.map((project, index) => (
                      <RevealOnScroll key={index} delay={index * 150}>
                        <div className="group relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 hover:bg-slate-900 hover:-translate-y-1 h-full flex flex-col shadow-lg">
                          <div className={`h-1 w-full bg-gradient-to-r ${project.color}`}></div>
                          
                          <div className="p-6 flex-grow flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                              <div className="px-2 py-1 text-xs font-mono text-emerald-300 bg-emerald-900/30 rounded border border-emerald-900">
                                {project.category}
                              </div>
                              <Github size={20} className="text-slate-600 group-hover:text-white transition-colors cursor-pointer" onClick={() => showToast("GitHub Link kopiert (Demo)", "success")} />
                            </div>
                            
                            <h3 className="text-xl font-bold mb-2 text-slate-200 group-hover:text-emerald-400 transition-colors font-mono">
                              {project.title}
                            </h3>
                            <p className="text-slate-400 text-sm mb-6 flex-grow">
                              {project.desc}
                            </p>
                            
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800 mb-4">
                              {project.tags.map(tag => (
                                <span key={tag} className="text-xs text-slate-500 font-mono">
                                  #{tag}
                                </span>
                              ))}
                            </div>

                            <div className="mt-auto">
                               {analyses[index] ? (
                                 <div className="bg-emerald-900/20 border border-emerald-500/20 p-3 rounded text-xs text-emerald-200 animate-fadeIn">
                                   <div className="flex items-center gap-2 mb-1 font-bold text-emerald-400">
                                     <Bot size={14} /> AI ANALYSE:
                                   </div>
                                   {analyses[index]}
                                 </div>
                               ) : (
                                 <button 
                                   onClick={() => analyzeStack(index, project)}
                                   disabled={analyzing === index}
                                   className="w-full py-2 rounded border border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all text-xs font-bold text-slate-400 flex items-center justify-center gap-2"
                                 >
                                   {analyzing === index ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                                   {analyzing === index ? "Analysiere Stack..." : "✨ STACK CHECK"}
                                 </button>
                               )}
                            </div>
                          </div>
                        </div>
                      </RevealOnScroll>
                    ))}
                  </div>
                </div>
              </section>

              {/* ABOUT ME SECTION */}
              <section id="me" className="py-20 relative overflow-hidden">
                <div className="container mx-auto px-6 flex flex-col md:flex-row gap-16 items-center">
                  
                  <div className="w-full md:w-1/2">
                    <RevealOnScroll>
                      <h2 className="text-3xl md:text-4xl font-bold mb-6 border-l-4 border-cyan-500 pl-6">Hinter dem Avatar</h2>
                      <div className="space-y-4 text-slate-400 text-lg leading-relaxed">
                        <p>
                          Hi, ich bin Domse. Ich erschaffe Dinge. Ob atmosphärische Videos, 
                          <span className="text-emerald-400 font-bold"> hochkomplexe Redstone-Fails </span> 
                          oder Skripte, die meinen Workflow retten.
                        </p>
                        <p>
                          Diese Seite ist mein Archiv. Hier experimentiere ich mit neuen Schnitttechniken, grinde Leaderboards oder baue Tools. Alles just for fun, aber mit Anspruch.
                        </p>
                      </div>
                      
                      <div className="mt-8 grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 transition-colors">
                          <div className="flex items-center gap-2 text-purple-400 font-bold mb-1">
                            <Gamepad2 size={18} /> Gaming
                          </div>
                          <div className="text-sm text-slate-500">Survival, FPS & Indie Games</div>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-pink-500/50 transition-colors">
                          <div className="flex items-center gap-2 text-pink-400 font-bold mb-1">
                            <Clapperboard size={18} /> Editing
                          </div>
                          <div className="text-sm text-slate-500">Premiere & Photoshop</div>
                        </div>
                      </div>
                    </RevealOnScroll>
                  </div>

                  <div className="w-full md:w-1/2">
                      <h3 className="text-xl font-bold mb-6 text-slate-200">Toolbox</h3>
                      <div className="grid grid-cols-3 gap-4">
                        {['PowerShell', 'C#', 'Bash', 'Premiere', 'OBS', 'Photoshop'].map((skill, i) => (
                           <RevealOnScroll key={skill} delay={i * 100}>
                             <div className="py-3 px-4 rounded-lg bg-slate-900 border border-slate-800 text-center text-slate-400 hover:text-white hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all cursor-default text-sm font-mono transform hover:scale-105">
                               {skill}
                             </div>
                           </RevealOnScroll>
                        ))}
                      </div>
                  </div>
                </div>
              </section>

              {/* FOOTER */}
              <footer className="py-20 border-t border-slate-800 bg-[#020617] relative overflow-hidden">
                <div className="container mx-auto px-6">
                   <RevealOnScroll>
                     <div className="relative group overflow-hidden rounded-xl bg-slate-900/50 border border-indigo-500/30 p-8 md:p-12 transition-all hover:border-indigo-500/60 hover:shadow-[0_0_30px_rgba(99,102,241,0.1)]">
                        {/* Animated Background Scanline */}
                        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(transparent_0%,#6366f1_50%,transparent_100%)] bg-[length:100%_4px] animate-scan"></div>
                        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                           <div className="text-center md:text-left">
                              <div className="flex items-center justify-center md:justify-start gap-2 text-indigo-400 mb-2">
                                  <Radio className="animate-pulse" size={16} />
                                  <span className="text-xs font-mono tracking-[0.2em] uppercase">Transmission Active</span>
                              </div>
                              <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 mb-4">
                                  INITIATE CONTACT
                              </h2>
                              <p className="text-slate-400 max-w-md mx-auto md:mx-0">
                                  Hast du eine Quest, ein Projekt oder willst einfach nur nerden?
                                  Mein Kommunikationskanal ist offen.
                              </p>
                           </div>
                           
                           <div className="flex gap-4">
                              {/* Links */}
                              <a href="https://discord.gg/eX4tEfd3" target="_blank" rel="noreferrer" className="group/icon relative p-4 rounded-lg bg-slate-950 border border-indigo-500/30 hover:border-indigo-400 hover:bg-indigo-500/10 transition-all overflow-hidden" title="Discord">
                                 <div className="absolute inset-0 bg-indigo-500/20 translate-y-full group-hover/icon:translate-y-0 transition-transform duration-300"></div>
                                 <User className="relative z-10 text-slate-400 group-hover/icon:text-white" size={24} />
                              </a>
                              <a href="https://github.com/domse321" target="_blank" rel="noreferrer" className="group/icon relative p-4 rounded-lg bg-slate-950 border border-indigo-500/30 hover:border-indigo-400 hover:bg-indigo-500/10 transition-all overflow-hidden">
                                 <div className="absolute inset-0 bg-indigo-500/20 translate-y-full group-hover/icon:translate-y-0 transition-transform duration-300"></div>
                                 <Github className="relative z-10 text-slate-400 group-hover/icon:text-white" size={24} />
                              </a>
                              <a href="https://youtube.com/@domse321?si=v1fHEhym9j43JawK" target="_blank" rel="noreferrer" className="group/icon relative p-4 rounded-lg bg-slate-950 border border-indigo-500/30 hover:border-indigo-400 hover:bg-indigo-500/10 transition-all overflow-hidden">
                                 <div className="absolute inset-0 bg-indigo-500/20 translate-y-full group-hover/icon:translate-y-0 transition-transform duration-300"></div>
                                 <Youtube className="relative z-10 text-slate-400 group-hover/icon:text-white" size={24} />
                              </a>
                           </div>
                        </div>
                     </div>
                   </RevealOnScroll>
                   
                   <div className="mt-12 text-center">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-500 font-mono">
                          <span>SYSTEM: ONLINE</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      </div>
                      <p className="mt-4 text-xs text-slate-700 font-mono">
                          EDIT & LOOT // Domse321 // {new Date().getFullYear()}
                      </p>
                   </div>
                </div>
              </footer>
            </div>
          );
        }

        const root = createRoot(document.getElementById('root'));
        root.render(<Portfolio />);
