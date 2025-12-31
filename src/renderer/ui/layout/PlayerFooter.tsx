import React from "react";

export function PlayerFooter() {
  return (
    <footer className="bg-gray-800 border-t border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Currently Playing Info */}
        <div className="flex items-center space-x-4 w-1/3">
          <div className="w-12 h-12 rounded bg-gray-700 flex items-center justify-center">
            <i className="fas fa-headphones text-gray-300"></i>
          </div>
          <div>
            <h4 className="text-sm font-medium">—</h4>
            <p className="text-xs text-gray-400">Not playing</p>
          </div>
        </div>

        {/* Media Controls */}
        <div className="flex flex-col items-center w-1/3">
          <div className="flex items-center space-x-4 mb-2">
            <button className="text-gray-400 hover:text-white transition-colors" title="Previous chapter">
              <i className="fas fa-step-backward"></i>
            </button>
            <button className="text-gray-400 hover:text-white transition-colors" title="Back 10 seconds">
              <i className="fas fa-backward text-lg"></i>
            </button>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              title="Play/Pause"
            >
              <i className="fas fa-play"></i>
            </button>
            <button className="text-gray-400 hover:text-white transition-colors" title="Forward 10 seconds">
              <i className="fas fa-forward text-lg"></i>
            </button>
            <button className="text-gray-400 hover:text-white transition-colors" title="Next chapter">
              <i className="fas fa-step-forward"></i>
            </button>
          </div>

          {/* Progress Bar (placeholder) */}
          <div className="flex items-center space-x-3 w-full max-w-md">
            <span className="text-xs text-gray-400">0:00</span>
            <div className="flex-1 bg-gray-600 h-1 rounded-full">
              <div className="bg-blue-500 h-1 rounded-full" style={{ width: "0%" }}></div>
            </div>
            <span className="text-xs text-gray-400">0:00</span>
          </div>
        </div>

        {/* Additional Controls */}
        <div className="flex items-center space-x-4 w-1/3 justify-end">
          <div className="flex items-center space-x-2">
            <i className="fas fa-tachometer-alt text-gray-400 text-sm"></i>
            <select className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white">
              <option>1x</option>
              <option>1.25x</option>
              <option>1.5x</option>
              <option>2x</option>
            </select>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors" title="Bookmark">
            <i className="fas fa-bookmark"></i>
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" title="Volume">
            <i className="fas fa-volume-up"></i>
          </button>
          <div className="w-20 bg-gray-600 h-1 rounded-full">
            <div className="bg-white h-1 rounded-full" style={{ width: "75%" }}></div>
          </div>
        </div>
      </div>
    </footer>
  );
}


