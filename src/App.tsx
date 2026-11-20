import { useEffect, useRef } from 'react';
import { GameEngine } from './game/Engine';
import { MainMenu } from './ui/MainMenu';
import { HUD } from './ui/HUD';
import { MobileControls } from './ui/MobileControls';
import { Pause } from './ui/Pause';
import { UpgradePicker } from './ui/UpgradePicker';
import { GameOver } from './ui/GameOver';
import { Settings } from './ui/Settings';

/* ==========================================
   المكوّن الجذري للتطبيق
   يعزل حاوية الـ WebGL Canvas بالكامل عن طبقات React حتى لا يعاد بناء المشهد أبداً
   ========================================== */

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new GameEngine(container);
    return () => {
      engine.dispose();
    };
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#050811]" dir="rtl">
      {/* حاوية مشهد Three.js المعزولة */}
      <div
        ref={canvasMountRef}
        data-testid="game-viewport"
        className="fixed inset-0 z-0 w-full h-full"
      />

      {/* طبقات واجهة المستخدم التفاعلية بالعربية */}
      <MainMenu />
      <HUD />
      <MobileControls />
      <Pause />
      <UpgradePicker />
      <GameOver />
      <Settings />
    </main>
  );
}
