import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float, Stars } from '@react-three/drei';
import { motion } from 'framer-motion';
import { Music, Mic2, Radio, PlayCircle } from 'lucide-react';
import './index.css';

// --- 3D Background Component representing "Audio Energy" ---
const AudioEnergyScene = () => {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#ffffff" />
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
      
      {/* Neon Blue Sound Wave Sphere */}
      <Float speed={2} rotationIntensity={2} floatIntensity={3}>
        <Sphere args={[1.8, 64, 64]} position={[-3, 1, -4]}>
          <MeshDistortMaterial 
            color="#00e5ff" 
            emissive="#0055ff"
            emissiveIntensity={0.5}
            distort={0.6} 
            speed={3} 
            roughness={0.1}
            metalness={0.8}
            wireframe={true}
          />
        </Sphere>
      </Float>

      {/* Neon Green Rhythm Sphere */}
      <Float speed={3} rotationIntensity={1.5} floatIntensity={2}>
        <Sphere args={[1.4, 64, 64]} position={[3, -2, -3]}>
          <MeshDistortMaterial 
            color="#00ff88" 
            emissive="#008844"
            emissiveIntensity={0.6}
            distort={0.4} 
            speed={4} 
            roughness={0.2}
            metalness={0.9}
          />
        </Sphere>
      </Float>
    </>
  );
};

// --- Glassmorphic UI Card Component ---
const GlassCard = ({ icon: Icon, title, desc, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8, delay }}
    className="relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all duration-300 group cursor-pointer"
  >
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    <Icon className="w-12 h-12 text-emerald-400 mb-6 group-hover:text-cyan-400 transition-colors" />
    <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
    <p className="text-slate-300 leading-relaxed">{desc}</p>
  </motion.div>
);

// --- Main App Component ---
export default function App() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans overflow-x-hidden">
      
      {/* 3D Canvas Background */}
      <div className="fixed inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <AudioEnergyScene />
        </Canvas>
      </div>

      {/* Gradient Overlay to blend 3D and UI */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#050505]/60 to-[#050505] pointer-events-none" />

      {/* Main Content (Foreground) */}
      <div className="relative z-10 container mx-auto px-6 py-12 flex flex-col min-h-screen">
        
        {/* Navigation */}
        <nav className="flex justify-between items-center bg-white/5 backdrop-blur-lg border border-white/10 rounded-full px-8 py-4 mb-20 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
          <div className="text-2xl font-black tracking-widest bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            WILDWOOD
          </div>
          <div className="hidden md:flex gap-8 text-sm font-semibold tracking-wide text-slate-300">
            <a href="#" className="hover:text-white transition-colors">RELEASES</a>
            <a href="#" className="hover:text-white transition-colors">ARTISTS</a>
            <a href="#" className="hover:text-white transition-colors">SERVICES</a>
          </div>
          <button className="bg-white/10 hover:bg-white/20 border border-white/20 px-6 py-2 rounded-full backdrop-blur-md transition-all text-sm font-bold">
            CONTACT US
          </button>
        </nav>

        {/* Hero Section */}
        <div className="flex-grow flex flex-col justify-center items-center text-center mt-10 md:mt-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
          >
            <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter">
              SHAPE THE <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500">
                SOUNDSCAPE
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 font-light">
              An independent record label based in India. We invest our resources in good music and the underground talents that create it.
            </p>
            
            <div className="flex gap-6 justify-center">
              <button className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer">
                <PlayCircle className="w-5 h-5" /> Submit Demo
              </button>
            </div>
          </motion.div>
        </div>

        {/* Services / Operations Section */}
        <div className="mt-32 mb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GlassCard 
              icon={Music}
              title="Music Production"
              desc="A collaborative and innovative environment where artists can thrive, grow, and craft their signature sound."
              delay={0.2}
            />
            <GlassCard 
              icon={Radio}
              title="Global Distribution"
              desc="Pushing your tracks to Spotify, Apple Music, JioSaavn, and 150+ streaming platforms worldwide."
              delay={0.4}
            />
            <GlassCard 
              icon={Mic2}
              title="Talent Management"
              desc="Representing visionaries who want to break boundaries and be recognized on the international stage."
              delay={0.6}
            />
          </div>
        </div>

      </div>
    </div>
  );
}