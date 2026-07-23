'use client';

import LastStandContainer from '@/components/game/LastStandContainer';

export default function GamePage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page Title */}
      <div className="mb-6 lg:mb-8">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-header text-foreground mb-2">The Hollow: Last Stand</h2>
        <p className="text-muted-blue text-xs sm:text-sm">Face the horde. Survive the waves. Claim your place on the leaderboard.</p>
      </div>

      {/* Game Controls - Desktop Only */}
      <div className="ui-container rounded p-4 lg:p-6 hidden md:block">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-blue mb-4">Game Controls</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="flex gap-1">
              <kbd className="px-2 lg:px-3 py-1 lg:py-2 bg-white/10 border border-white/20 rounded text-text-primary font-mono text-xs lg:text-sm">A</kbd>
              <kbd className="px-2 lg:px-3 py-1 lg:py-2 bg-white/10 border border-white/20 rounded text-text-primary font-mono text-xs lg:text-sm">D</kbd>
            </div>
            <div>
              <p className="text-text-primary font-bold text-xs lg:text-sm">Move</p>
              <p className="text-muted-blue text-[10px] lg:text-xs">Left / Right</p>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <div className="flex gap-1">
              <kbd className="px-2 lg:px-3 py-1 lg:py-2 bg-white/10 border border-white/20 rounded text-text-primary font-mono text-xs lg:text-sm">W</kbd>
              <kbd className="px-2 lg:px-3 py-1 lg:py-2 bg-white/10 border border-white/20 rounded text-text-primary font-mono text-xs lg:text-sm">Space</kbd>
            </div>
            <div>
              <p className="text-text-primary font-bold text-xs lg:text-sm">Jump</p>
              <p className="text-muted-blue text-[10px] lg:text-xs">Leap over enemies</p>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <kbd className="px-2 lg:px-3 py-1 lg:py-2 bg-white/10 border border-white/20 rounded text-text-primary font-mono text-xs lg:text-sm">J</kbd>
            <div>
              <p className="text-text-primary font-bold text-xs lg:text-sm">Attack</p>
              <p className="text-muted-blue text-[10px] lg:text-xs">Hold for charged</p>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <div className="flex gap-1">
              <kbd className="px-2 lg:px-3 py-1 lg:py-2 bg-white/10 border border-white/20 rounded text-text-primary font-mono text-xs lg:text-sm">L</kbd>
              <kbd className="px-2 lg:px-3 py-1 lg:py-2 bg-white/10 border border-white/20 rounded text-text-primary font-mono text-xs lg:text-sm">Shift</kbd>
            </div>
            <div>
              <p className="text-text-primary font-bold text-xs lg:text-sm">Dodge</p>
              <p className="text-muted-blue text-[10px] lg:text-xs">Evade attacks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Controls Info */}
      <div className="ui-container rounded p-4 md:hidden">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-blue mb-2">Mobile Controls</h3>
        <p className="text-xs text-muted-blue">Touch controls will appear below the game canvas</p>
      </div>

      {/* Game Container */}
      <LastStandContainer />
    </div>
  );
}
