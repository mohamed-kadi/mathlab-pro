import { useEffect, useRef } from 'react';
import katex from 'katex';

interface LatexProps {
  expression: string;
  displayMode?: boolean;
  className?: string;
  id?: string;
}

export default function Latex({ expression, displayMode = false, className = '', id }: LatexProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(expression, containerRef.current, {
          displayMode,
          throwOnError: false,
          trust: true,
        });
      } catch (err) {
        console.error("KaTeX rendering error:", err);
        containerRef.current.textContent = expression;
      }
    }
  }, [expression, displayMode]);

  return (
    <span 
      id={id}
      ref={containerRef} 
      className={`inline-block select-text text-zinc-100 ${className} ${displayMode ? 'w-full overflow-x-auto py-2' : ''}`}
    />
  );
}
