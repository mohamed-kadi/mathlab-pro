import React, { useEffect, useRef, useState } from 'react';
import { create, all } from 'mathjs';
import { Play, ZoomIn, ZoomOut, Maximize2, ShieldAlert } from 'lucide-react';
import { GraphEquation } from '../types';

const math = create(all);

interface GraphingEngineProps {
  equations: GraphEquation[];
  points?: { x: number; y: number }[];
  viewport?: { xMin: number; xMax: number; yMin: number; yMax: number };
  onViewportChange?: (viewport: { xMin: number; xMax: number; yMin: number; yMax: number }) => void;
  id?: string;
}

export default function GraphingEngine({
  equations,
  points = [],
  viewport: controlledViewport,
  onViewportChange,
  id
}: GraphingEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Viewport state
  const [viewport, setViewport] = useState({
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10
  });

  // Cursor tracer coordinates
  const [mouseCoord, setMouseCoord] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragViewportStart = useRef({ xMin: 0, xMax: 0, yMin: 0, yMax: 0 });

  // Sync controlled viewport if provided
  useEffect(() => {
    if (controlledViewport) {
      setViewport(controlledViewport);
    }
  }, [controlledViewport]);

  // Adjust canvas size to parent container
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({
          width: Math.max(300, entry.contentRect.width),
          height: Math.max(300, entry.contentRect.height)
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute scale conversions
  const toScreenX = (x: number) => {
    return ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * dimensions.width;
  };

  const toScreenY = (y: number) => {
    return dimensions.height - ((y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * dimensions.height;
  };

  const toMathX = (screenX: number) => {
    return viewport.xMin + (screenX / dimensions.width) * (viewport.xMax - viewport.xMin);
  };

  const toMathY = (screenY: number) => {
    return viewport.yMin + ((dimensions.height - screenY) / dimensions.height) * (viewport.yMax - viewport.yMin);
  };

  // Redraw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // DRAW GRID & LABELS
    ctx.strokeStyle = '#e2e8f0'; // slate-200
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Grid spacing heuristics
    const xRange = viewport.xMax - viewport.xMin;
    let xStep = 1;
    if (xRange > 100) xStep = 20;
    else if (xRange > 50) xStep = 10;
    else if (xRange > 20) xStep = 5;
    else if (xRange > 5) xStep = 1;
    else if (xRange > 1) xStep = 0.2;
    else xStep = 0.05;

    const yRange = viewport.yMax - viewport.yMin;
    let yStep = xStep; // keep uniform

    // Vertical grid lines
    const startX = Math.floor(viewport.xMin / xStep) * xStep;
    for (let x = startX; x <= viewport.xMax; x += xStep) {
      if (Math.abs(x) < 1e-10) continue; // skip core axis
      const sx = toScreenX(x);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, dimensions.height);
      ctx.stroke();

      // label
      const sAxisY = Math.max(10, Math.min(dimensions.height - 20, toScreenY(0)));
      ctx.fillText(parseFloat(x.toFixed(4)).toString(), sx, sAxisY + 4);
    }

    // Horizontal grid lines
    const startY = Math.floor(viewport.yMin / yStep) * yStep;
    for (let y = startY; y <= viewport.yMax; y += yStep) {
      if (Math.abs(y) < 1e-10) continue; // skip core axis
      const sy = toScreenY(y);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(dimensions.width, sy);
      ctx.stroke();

      // label
      const sAxisX = Math.max(15, Math.min(dimensions.width - 20, toScreenX(0)));
      ctx.textAlign = 'right';
      ctx.fillText(parseFloat(y.toFixed(4)).toString(), sAxisX - 6, sy - 4);
      ctx.textAlign = 'center';
    }

    // DRAW AXES
    ctx.strokeStyle = '#94a3b8'; // slate-400
    ctx.lineWidth = 2;
    // X Axis
    const axisY = toScreenY(0);
    ctx.beginPath();
    ctx.moveTo(0, axisY);
    ctx.lineTo(dimensions.width, axisY);
    ctx.stroke();

    // Y Axis
    const axisX = toScreenX(0);
    ctx.beginPath();
    ctx.moveTo(axisX, 0);
    ctx.lineTo(axisX, dimensions.height);
    ctx.stroke();

    // DRAW DISCRETE POINTS (if any)
    if (points && points.length > 0) {
      ctx.fillStyle = '#10b981'; // emerald-500
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 1.5;
      points.forEach(p => {
        const sx = toScreenX(p.x);
        const sy = toScreenY(p.y);
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label points
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '8px monospace';
        ctx.fillText(`(${p.x}, ${p.y})`, sx, sy - 12);
      });
    }

    // DRAW EQUATIONS
    equations.forEach(eq => {
      if (!eq.visible || !eq.expression) return;

      ctx.strokeStyle = eq.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      if (eq.type === 'y=f(x)') {
        let isFirst = true;
        try {
          const compiled = math.parse(eq.expression).compile();
          
          for (let sx = 0; sx < dimensions.width; sx += 1.5) {
            const mx = toMathX(sx);
            try {
              const my = compiled.evaluate({ x: mx });
              if (typeof my === 'number' && !isNaN(my) && isFinite(my)) {
                const sy = toScreenY(my);
                if (sy >= -50 && sy <= dimensions.height + 50) {
                  if (isFirst) {
                    ctx.moveTo(sx, sy);
                    isFirst = false;
                  } else {
                    ctx.lineTo(sx, sy);
                  }
                } else {
                  isFirst = true;
                }
              } else {
                isFirst = true;
              }
            } catch {
              isFirst = true;
            }
          }
          ctx.stroke();
        } catch (e) {
          console.error("Syntax math compilation failure inside equation drawer:", e);
        }
      } else if (eq.type === 'parametric' && eq.paraX && eq.paraY) {
        // Parametric curve tracing t from 0 to 2*pi
        let isFirst = true;
        try {
          const complX = math.parse(eq.paraX).compile();
          const complY = math.parse(eq.paraY).compile();
          
          const stepsCount = 200;
          for (let i = 0; i <= stepsCount; i++) {
            const t = (i / stepsCount) * Math.PI * 4; // Traces up to 4pi for complex spirals
            try {
              const mx = complX.evaluate({ t });
              const my = complY.evaluate({ t });
              
              if (typeof mx === 'number' && typeof my === 'number') {
                const sx = toScreenX(mx);
                const sy = toScreenY(my);
                
                if (isFirst) {
                  ctx.moveTo(sx, sy);
                  isFirst = false;
                } else {
                  ctx.lineTo(sx, sy);
                }
              }
            } catch {
              isFirst = true;
            }
          }
          ctx.stroke();
        } catch {}
      } else if (eq.type === 'polar') {
        // Polar mapping r = f(theta)
        let isFirst = true;
        try {
          const compiled = math.parse(eq.expression).compile();
          const stepsCount = 360;
          for (let i = 0; i <= stepsCount; i++) {
            const theta = (i / stepsCount) * Math.PI * 2;
            try {
              const r = compiled.evaluate({ theta, θ: theta });
              if (typeof r === 'number') {
                const mx = r * Math.cos(theta);
                const my = r * Math.sin(theta);
                const sx = toScreenX(mx);
                const sy = toScreenY(my);
                
                if (isFirst) {
                  ctx.moveTo(sx, sy);
                  isFirst = false;
                } else {
                  ctx.lineTo(sx, sy);
                }
              }
            } catch {
              isFirst = true;
            }
          }
          ctx.stroke();
        } catch {}
      }
    });

    // DRAW tracer values
    if (mouseCoord) {
      ctx.strokeStyle = '#3f3f46'; // zinc-700
      ctx.setLineDash([4, 4]);
      const smx = toScreenX(mouseCoord.x);
      
      // vertical dashed tracer line
      ctx.beginPath();
      ctx.moveTo(smx, 0);
      ctx.lineTo(smx, dimensions.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // For each function, find intercept
      equations.forEach(eq => {
        if (!eq.visible || !eq.expression || eq.type !== 'y=f(x)') return;
        try {
          const val = math.parse(eq.expression).compile().evaluate({ x: mouseCoord.x });
          if (typeof val === 'number' && !isNaN(val)) {
            const smy = toScreenY(val);
            
            ctx.fillStyle = eq.color;
            ctx.beginPath();
            ctx.arc(smx, smy, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // outline bubble
            ctx.strokeStyle = '#18181b';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Intercept HUD info
            ctx.fillStyle = '#f4f4f5';
            ctx.font = '9px monospace';
            ctx.fillText(`(${mouseCoord.x.toFixed(2)}, ${val.toFixed(2)})`, smx, smy - 12);
          }
        } catch {}
      });
    }

  }, [dimensions, viewport, equations, points, mouseCoord]);

  // Handle Drag / Pan Events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragViewportStart.current = { ...viewport };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const mathX = toMathX(sx);
    const mathY = toMathY(sy);

    if (isDragging) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      
      const widthRange = dragViewportStart.current.xMax - dragViewportStart.current.xMin;
      const heightRange = dragViewportStart.current.yMax - dragViewportStart.current.yMin;
      
      const shiftX = (dx / dimensions.width) * widthRange;
      const shiftY = (dy / dimensions.height) * heightRange;

      const nextViewport = {
        xMin: dragViewportStart.current.xMin - shiftX,
        xMax: dragViewportStart.current.xMax - shiftX,
        yMin: dragViewportStart.current.yMin + shiftY,
        yMax: dragViewportStart.current.yMax + shiftY
      };

      setViewport(nextViewport);
      if (onViewportChange) {
        onViewportChange(nextViewport);
      }
    } else {
      setMouseCoord({ x: mathX, y: mathY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setMouseCoord(null);
  };

  // Zoom controls helper
  const handleZoom = (factor: number) => {
    const xMid = (viewport.xMax + viewport.xMin) / 2;
    const yMid = (viewport.yMax + viewport.yMin) / 2;
    const halfWidth = ((viewport.xMax - viewport.xMin) * factor) / 2;
    const halfHeight = ((viewport.yMax - viewport.yMin) * factor) / 2;

    const nextViewport = {
      xMin: xMid - halfWidth,
      xMax: xMid + halfWidth,
      yMin: yMid - halfHeight,
      yMax: yMid + halfHeight
    };

    setViewport(nextViewport);
    if (onViewportChange) {
      onViewportChange(nextViewport);
    }
  };

  const handleReset = () => {
    const defaultV = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
    setViewport(defaultV);
    if (onViewportChange) {
      onViewportChange(defaultV);
    }
  };

  return (
    <div id={id} ref={containerRef} className="relative w-full h-full bg-[#f8fafc] border border-slate-200 rounded-lg overflow-hidden flex flex-col select-none">
      <div className="absolute top-3 right-3 flex items-center space-x-1 bg-white/95 border border-slate-200 p-1.5 rounded-lg shadow-sm z-20 backdrop-blur-sm">
        <button
          onClick={() => handleZoom(0.7)}
          className="p-1 px-1.5 hover:bg-slate-50 text-slate-600 rounded transition flex items-center cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(1.3)}
          className="p-1 px-1.5 hover:bg-slate-50 text-slate-600 rounded transition flex items-center cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="p-1 px-2 hover:bg-slate-50 text-xs text-slate-500 font-mono rounded transition cursor-pointer"
          title="Reset Axes View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <canvas
        id="graphing-canvas-panel"
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair w-full h-full"
      />

      <div className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-400 bg-white/90 p-1 px-2 rounded backdrop-blur-xs pointer-events-none z-10 flex space-x-3 border border-slate-100 shadow-xs">
        <span>X: [{viewport.xMin.toFixed(1)}, {viewport.xMax.toFixed(1)}]</span>
        <span>Y: [{viewport.yMin.toFixed(1)}, {viewport.yMax.toFixed(1)}]</span>
      </div>
    </div>
  );
}
