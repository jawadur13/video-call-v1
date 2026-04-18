"use client";
import React, { useEffect, useRef } from 'react';

interface AdsterraAdProps {
  id?: string;
  type: 'native' | '300x250' | '728x90';
}

const AdsterraAd: React.FC<AdsterraAdProps> = ({ id, type }) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adRef.current) return;

    // Clear previous content
    adRef.current.innerHTML = '';

    if (type === 'native') {
      const containerId = "container-16d557600d6843dcc7548828037cf730";
      const div = document.createElement('div');
      div.id = containerId;
      adRef.current.appendChild(div);

      const script = document.createElement('script');
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.src = "https://pl29183972.profitablecpmratenetwork.com/16d557600d6843dcc7548828037cf730/invoke.js";
      adRef.current.appendChild(script);
    } else {
      // 300x250 or 728x90
      const atOptions = type === '300x250' ? {
        'key' : 'a0f7e2859cffea71e3293d76d9627da0',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      } : {
        'key' : '7380f7472343baa4d6d0d6fc41518799',
        'format' : 'iframe',
        'height' : 90,
        'width' : 728,
        'params' : {}
      };

      const scriptConfig = document.createElement('script');
      scriptConfig.innerHTML = `atOptions = ${JSON.stringify(atOptions)};`;
      adRef.current.appendChild(scriptConfig);

      const scriptInvoke = document.createElement('script');
      scriptInvoke.src = `https://www.highperformanceformat.com/${atOptions.key}/invoke.js`;
      adRef.current.appendChild(scriptInvoke);
    }
  }, [type]);

  return (
    <div 
      ref={adRef} 
      className="ad-container" 
      style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        margin: '20px 0',
        minHeight: type === '300x250' ? '250px' : type === '728x90' ? '90px' : 'auto',
        overflow: 'hidden',
        borderRadius: '12px'
      }} 
    />
  );
};

export default AdsterraAd;
