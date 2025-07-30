"use client";

import { useEffect, useState } from "react";

export function LoadingDots() {
  const [dots, setDots] = useState(1);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev >= 3 ? 1 : prev + 1);
    }, 400);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex items-center justify-center">
      <span className="inline-flex items-center">
        <span 
          className={`text-lg transition-all duration-300 ${dots >= 1 ? 'opacity-100 scale-110' : 'opacity-30 scale-100'}`}
        >
          •
        </span>
        <span 
          className={`text-lg mx-1 transition-all duration-300 ${dots >= 2 ? 'opacity-100 scale-110' : 'opacity-30 scale-100'}`}
        >
          •
        </span>
        <span 
          className={`text-lg transition-all duration-300 ${dots >= 3 ? 'opacity-100 scale-110' : 'opacity-30 scale-100'}`}
        >
          •
        </span>
      </span>
    </div>
  );
} 