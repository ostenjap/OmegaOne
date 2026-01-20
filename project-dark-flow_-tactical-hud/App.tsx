
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LogEntry } from './types';
import { FluidEngine } from './services/fluidEngine';
import { getTacticalChat } from './services/geminiService';

const App: React.FC = () => {
  // Simulation State
  const [flowSpeed, setFlowSpeed] = useState(0.1);
  const [viscosity, setViscosity] = useState(0.02);
  const [contrast, setContrast] = useState(1500);
  const [resolution, setResolution] = useState('400x200');
  const [plotMode, setPlotMode] = useState('curl');
  const [isPaused, setIsPaused] = useState(false);
  const [showTracers, setShowTracers] = useState(true);
  const [showFlowlines, setShowFlowlines] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [stepsPerSecond, setStepsPerSecond] = useState(0);
  const [isFaster, setIsFaster] = useState(true);
  const [barrierMode, setBarrierMode] = useState('Draw barriers');

  // UI / Chat State
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', timestamp: new Date().toLocaleTimeString(), source: 'SYS', content: 'LATTICE BOLTZMANN CORE READY.' },
    { id: '2', timestamp: new Date().toLocaleTimeString(), source: 'SYS', content: 'SYSTEM UPLINK ESTABLISHED.' },
  ]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('SIMULATING_ACTIVE');
  const [isProcessing, setIsProcessing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FluidEngine | null>(null);
  const requestRef = useRef<number>(undefined);
  const stepCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  // Persistent Chat instance
  const chatInstance = useMemo(() => getTacticalChat(), []);

  const nx = 400;
  const ny = 200;

  useEffect(() => {
    engineRef.current = new FluidEngine({
      width: nx,
      height: ny,
      viscosity,
      inflowVelocity: flowSpeed,
    });
    engineRef.current.addObstacle(100, 100, 15);

    const animate = () => {
      const now = performance.now();
      if (engineRef.current && !isPaused) {
        const multiStep = isFaster ? animationSpeed * 2 : animationSpeed;
        for (let i = 0; i < multiStep; i++) {
          engineRef.current.step();
          stepCountRef.current++;
        }
        draw();
      }

      if (now - lastTimeRef.current > 1000) {
        setStepsPerSecond(stepCountRef.current);
        stepCountRef.current = 0;
        lastTimeRef.current = now;
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPaused, animationSpeed, isFaster]);

  const draw = () => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = plotMode === 'curl' ? engine.getVorticity() : engine.getSpeed();
    const obstacles = engine.getObstacles();
    const imageData = ctx.createImageData(nx, ny);

    for (let i = 0; i < nx * ny; i++) {
      const idx = i * 4;
      const val = Math.abs(data[i]) * contrast;
      if (obstacles[i]) {
        imageData.data[idx] = 200; imageData.data[idx + 1] = 200; imageData.data[idx + 2] = 200; imageData.data[idx + 3] = 255;
      } else {
        if (plotMode === 'curl') {
          const v = data[i] * contrast;
          imageData.data[idx] = 128 + v; imageData.data[idx + 1] = 128 - Math.abs(v); imageData.data[idx + 2] = 128 - v; imageData.data[idx + 3] = 255;
        } else {
          imageData.data[idx] = val * 0.2; imageData.data[idx + 1] = val * 0.6; imageData.data[idx + 2] = val; imageData.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    if (showTracers) {
      const tracers = engine.getTracers();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < tracers.length / 2; i++) ctx.fillRect(tracers[i * 2], tracers[i * 2 + 1], 1, 1);
    }

    if (showFlowlines) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      for (let y = 10; y < ny; y += 20) {
        ctx.moveTo(0, y);
        ctx.lineTo(nx, y);
      }
      ctx.stroke();
    }
  };

  const addLog = (source: LogEntry['source'], content: string) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      source,
      content
    }].slice(-40));
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    const userPrompt = input;
    setInput('');
    addLog('USER', userPrompt);
    setIsProcessing(true);
    setStatus('AI_THINKING');

    try {
      // Use the chat session for memory
      const response = await chatInstance.sendMessage({ message: userPrompt });
      const result = JSON.parse(response.text);

      if (result) {
        addLog('AI', result.tactical_message);
        const { type, data = {} } = result.action;

        if (type === 'generate_shape' && engineRef.current) {
          engineRef.current.clearObstacles();
          const cx = data.x || 150;
          const cy = data.y || 100;
          const radius = data.radius || 10;
          const shapeType = data.shape_type || 'ball';

          if (shapeType === 'naca') {
            // Generate NACA 0020 symmetrical airfoil
            // Formula: yt = 5*t*(0.2969*sqrt(x) - 0.1260*x - 0.3516*x^2 + 0.2843*x^3 - 0.1015*x^4)
            const chord = 80;
            const t = 0.20; // 20% thickness
            for (let i = 0; i <= chord; i += 0.5) {
              const x = i / chord;
              const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * Math.pow(x, 2) + 0.2843 * Math.pow(x, 3) - 0.1015 * Math.pow(x, 4));
              const yOffset = yt * chord;
              engineRef.current.addObstacle(cx - (chord / 2) + i, cy - yOffset, 1.5);
              engineRef.current.addObstacle(cx - (chord / 2) + i, cy + yOffset, 1.5);
            }
          } else if (shapeType === 'teardrop') {
            // Teardrop: hemisphere head + sinusoidal tail
            // Head
            const r = 12;
            for (let i = 0; i < 360; i++) {
              const rad = i * Math.PI / 180;
              // Draw circle part
              engineRef.current.addObstacle(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r, 1);
            }
            // Tail
            for (let i = 0; i < 60; i++) {
              const width = r * (1 - (i / 60));
              engineRef.current.addObstacle(cx + r + i, cy + width / 2, 1);
              engineRef.current.addObstacle(cx + r + i, cy - width / 2, 1);
            }
          } else if (shapeType === 'wing') {
            // Swept delta wing logic
            for (let i = 0; i < 60; i++) {
              engineRef.current.addObstacle(cx + i, cy + (i * 0.4), 1.5);
              engineRef.current.addObstacle(cx + i, cy - (i * 0.4), 1.5);
              // Fill
              if (i % 2 === 0) {
                for (let j = 0; j < (i * 0.4); j++) {
                  engineRef.current.addObstacle(cx + i, cy + j, 1.5);
                  engineRef.current.addObstacle(cx + i, cy - j, 1.5);
                }
              }
            }
          } else {
            // Default: Ball / Circle
            engineRef.current.addObstacle(cx, cy, radius);
          }
        } else if (type === 'reset_sim' && engineRef.current) {
          engineRef.current.reset(flowSpeed);
        } else if (type === 'change_velocity') {
          const v = data.velocity || flowSpeed;
          setFlowSpeed(v);
          engineRef.current?.setInflow(v);
        } else if (type === 'set_viscosity') {
          const v = data.viscosity || viscosity;
          setViscosity(v);
          engineRef.current?.setViscosity(v);
        }
      }
    } catch (err) {
      addLog('SYS', 'UPLINK ERROR: FAILED TO PARSE TACTICAL DATA.');
      console.error(err);
    } finally {
      setIsProcessing(false);
      setStatus('SIMULATING_ACTIVE');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col p-4 overflow-hidden bg-[#050505] text-[#f0f0f0]">
      {/* Header HUD */}
      <header className="flex justify-between items-end border-b border-[#333] pb-2 mb-4">
        <div className="flex gap-6 items-baseline">
          <div className="text-2xl font-black tracking-tighter uppercase italic text-white">Project Dark-Flow</div>
          <div className="text-[9px] text-[#666] tracking-[0.2em] font-bold">LATTICE BOLTZMANN TACTICAL ANALYSIS // REV 5.2</div>
        </div>
        <div className="text-right text-[9px] uppercase font-bold flex flex-col gap-1">
          <div className="flex items-center gap-2 justify-end">
            <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-red-500' : 'bg-[#ffae00] animate-pulse'}`}></span>
            STATUS: <span className={isPaused ? 'text-red-500' : 'text-[#ffae00]'}>{isPaused ? 'PAUSED' : status}</span>
          </div>
          <div className="text-[#444]">ENCRYPTION_LAYER: AES-256_ACTIVE</div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* Left Telemetry Column */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="border border-[#333] bg-[#0a0a0a] p-3">
            <div className="text-[#666] text-[8px] uppercase tracking-widest border-b border-[#333] mb-2">Atmospherics</div>
            <div className="text-[10px] space-y-1">
              <div className="flex justify-between"><span>FLOW_MACH</span><span className="text-[#ffae00]">0.84</span></div>
              <div className="flex justify-between"><span>RE_NUMBER</span><span className="text-[#ffae00]">4.2E5</span></div>
              <div className="flex justify-between"><span>STABILITY</span><span className="text-green-500">NOMINAL</span></div>
            </div>
          </div>
          <div className="flex-1 border border-[#333] bg-[#0a0a0a] p-3 flex flex-col overflow-hidden">
            <div className="text-[#666] text-[8px] uppercase tracking-widest border-b border-[#333] mb-2">Vector_Feed</div>
            <div className="flex-1 relative overflow-hidden opacity-30">
              {[...Array(15)].map((_, i) => (
                <div key={i} className="flex gap-1 mb-1 items-center">
                  <div className="w-4 text-[7px] font-mono">{(Math.random() * 90).toFixed(0)}</div>
                  <div className="h-1 bg-white/20 flex-1">
                    <div className="h-full bg-white/50" style={{ width: `${Math.random() * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Main Visualization */}
        <div className="col-span-7 flex flex-col border border-[#333] relative bg-black overflow-hidden shadow-inner">
          <div className="scanline"></div>
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <div className="border border-white/10 p-2 bg-black/60 backdrop-blur-sm">
              <div className="text-[8px] uppercase tracking-widest text-[#666] mb-1">LATTICE_RENDERER</div>
              <div className="text-lg font-black tracking-tight flex items-baseline gap-2">
                {plotMode.toUpperCase()}_GRADIENT
                <span className="text-[9px] text-[#ffae00] font-bold">STRICT_SUBSONIC</span>
              </div>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-[#050505] p-2">
            <canvas
              ref={canvasRef} width={nx} height={ny}
              className="w-full h-full border border-[#222] contrast-[1.5] brightness-110 object-contain cursor-crosshair"
              onMouseDown={(e) => {
                const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * nx;
                const y = ((e.clientY - rect.top) / rect.height) * ny;
                engineRef.current?.addObstacle(x, y, 10, barrierMode.includes('Erase'));
              }}
            />
          </div>
          <div className="h-6 border-t border-[#333] flex justify-between items-center px-3 text-[8px] text-[#444] font-bold tracking-tighter">
            <div>GRID_SPACE: 400x200 LBM</div>
            <div className="flex gap-4 items-center">
              <span>SPS: {stepsPerSecond}</span>
              <span className="text-[#666]">CONTRAST: {contrast}</span>
            </div>
          </div>
        </div>

        {/* Right Tactical Sidebar (The Requested "Another Window") */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          {/* Tactical Terminal Window */}
          <div className="flex-[0.6] flex flex-col border border-[#333] bg-[#0a0a0a] overflow-hidden">
            <div className="bg-white text-black text-[10px] font-black px-3 py-1 flex justify-between items-center">
              <span>TACTICAL_UPLINK</span>
              <span className="animate-pulse">●</span>
            </div>
            <div className="flex-1 p-3 text-[10px] overflow-y-auto space-y-2 font-mono scrollbar-hide">
              {logs.map(log => (
                <div key={log.id} className="flex flex-col border-b border-[#222] pb-1">
                  <div className="flex justify-between text-[8px] text-[#444]"><span>{log.source}</span><span>{log.timestamp}</span></div>
                  <div className={`${log.source === 'AI' ? 'text-white' : 'text-[#666]'}`}>{log.content}</div>
                </div>
              ))}
              {isProcessing && <div className="text-[#ffae00] animate-pulse">DECODING_SATELLITE_LINK...</div>}
            </div>
            <form onSubmit={handleCommand} className="p-2 border-t border-[#333] bg-black">
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)} disabled={isProcessing}
                className="w-full bg-[#111] border border-[#333] p-2 text-[10px] outline-none focus:border-[#ffae00] text-white"
                placeholder="ENTER COMMAND_UPLINK..."
              />
            </form>
          </div>

          {/* System Control Window (The requested panel) */}
          <div className="flex-[0.4] border border-[#333] bg-[#0a0a0a] flex flex-col overflow-hidden">
            <div className="bg-[#222] text-[#888] text-[9px] font-bold px-3 py-1 uppercase tracking-widest border-b border-[#333]">
              Engineering_Parameters
            </div>
            <div className="p-3 text-[10px] space-y-3 overflow-y-auto custom-scrollbar">
              <div className="flex gap-1">
                <select className="flex-1 bg-black border border-[#333] p-1 text-[9px] outline-none" value={resolution} onChange={e => setResolution(e.target.value)}>
                  <option>400 x 200</option>
                  <option>200 x 100</option>
                </select>
                <button onClick={() => engineRef.current?.reset(flowSpeed)} className="border border-[#333] px-1 hover:bg-[#222]">Reset fluid</button>
                <button onClick={() => { engineRef.current?.step(); draw(); }} className="border border-[#333] px-1 hover:bg-[#222]">Step</button>
                <button onClick={() => setIsPaused(!isPaused)} className="border border-[#333] px-1 hover:bg-[#222]">{isPaused ? 'Start' : 'Stop'}</button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-baseline"><span>Flow speed = {flowSpeed.toFixed(3)}</span></div>
                <input type="range" min="0" max="0.2" step="0.005" value={flowSpeed} onChange={e => {
                  const v = parseFloat(e.target.value); setFlowSpeed(v); engineRef.current?.setInflow(v);
                }} className="w-full h-1 bg-[#333] appearance-none accent-[#ffae00]" />

                <div className="flex justify-between items-baseline"><span>Viscosity = {viscosity.toFixed(3)}</span></div>
                <input type="range" min="0.005" max="0.1" step="0.005" value={viscosity} onChange={e => {
                  const v = parseFloat(e.target.value); setViscosity(v); engineRef.current?.setViscosity(v);
                }} className="w-full h-1 bg-[#333] appearance-none accent-[#ffae00]" />
              </div>

              <div className="flex gap-1">
                <select className="flex-1 bg-black border border-[#333] p-1 text-[9px] outline-none" value={barrierMode} onChange={e => setBarrierMode(e.target.value)}>
                  <option>Draw barriers</option>
                  <option>Erase barriers</option>
                </select>
                <select className="flex-1 bg-black border border-[#333] p-1 text-[9px] outline-none"><option>Barrier shapes</option></select>
                <button onClick={() => engineRef.current?.clearObstacles()} className="border border-[#333] px-1 hover:bg-[#222]">Clear</button>
              </div>

              <div className="flex gap-1 items-center">
                <select className="flex-1 bg-black border border-[#333] p-1 text-[9px] outline-none" value={plotMode} onChange={e => setPlotMode(e.target.value)}>
                  <option value="curl">Plot curl</option>
                  <option value="speed">Plot speed</option>
                </select>
                <span>Contrast:</span>
                <input type="range" min="100" max="4000" step="100" value={contrast} onChange={e => setContrast(parseInt(e.target.value))} className="w-16 h-1 bg-[#333] appearance-none accent-[#ffae00]" />
              </div>

              <div className="flex gap-2 items-center text-[9px]">
                <span>Anim speed:</span>
                <input type="range" min="1" max="10" step="1" value={animationSpeed} onChange={e => setAnimationSpeed(parseInt(e.target.value))} className="w-16 h-1 bg-[#333] appearance-none accent-[#ffae00]" />
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={isFaster} onChange={e => setIsFaster(e.target.checked)} className="accent-[#ffae00]" />
                  Faster?
                </label>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8px] uppercase font-bold text-[#666]">
                <label className="flex items-center gap-1"><input type="checkbox" checked={showTracers} onChange={e => setShowTracers(e.target.checked)} className="accent-[#ffae00]" /> Tracers</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={showFlowlines} onChange={e => setShowFlowlines(e.target.checked)} className="accent-[#ffae00]" /> Flowlines</label>
                <label className="flex items-center gap-1 opacity-50"><input type="checkbox" disabled /> Force on barriers</label>
                <label className="flex items-center gap-1 opacity-50"><input type="checkbox" disabled /> Sensor</label>
                <label className="flex items-center gap-1 opacity-50"><input type="checkbox" disabled /> Data</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
