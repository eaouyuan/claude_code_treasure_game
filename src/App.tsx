import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Button } from './components/ui/button';
import { AuthScreen } from './components/AuthScreen';
import { fetchMe, fetchScores, getToken, saveScore, signOut, type ScoreSummary } from './api';
import closedChest from './assets/treasure_closed.png';
import treasureChest from './assets/treasure_opened.png';
import skeletonChest from './assets/treasure_opened_skeleton.png';
import chestOpenSound from './audios/chest_open.mp3';
import evilLaughSound from './audios/chest_open_with_evil_laugh.mp3';
import keyCursor from './assets/key.png';

interface Box {
  id: number;
  isOpen: boolean;
  hasTreasure: boolean;
}

// Signed-in player, guest (nothing stored), or not chosen yet
type Player = { username: string } | 'guest' | null;

export default function App() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [score, setScore] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [player, setPlayer] = useState<Player>(null);
  const [checkingSession, setCheckingSession] = useState(() => !!getToken());
  const [history, setHistory] = useState<ScoreSummary | null>(null);

  const initializeGame = () => {
    // Randomly assign treasure to one box
    const treasureBoxIndex = Math.floor(Math.random() * 3);
    const newBoxes: Box[] = Array.from({ length: 3 }, (_, index) => ({
      id: index,
      isOpen: false,
      hasTreasure: index === treasureBoxIndex,
    }));
    
    setBoxes(newBoxes);
    setScore(0);
    setGameEnded(false);
  };

  // Initialize game automatically when component mounts
  useEffect(() => {
    initializeGame();
  }, []);

  // Restore a saved session on reload
  useEffect(() => {
    if (!checkingSession) return;
    fetchMe().then(username => {
      if (username) setPlayer({ username });
      setCheckingSession(false);
    });
  }, []);

  // Save the final score for signed-in players (guests store nothing)
  useEffect(() => {
    if (!gameEnded || !player || player === 'guest') return;
    saveScore(score)
      .then(fetchScores)
      .then(setHistory)
      .catch(err => console.error('Failed to save score', err));
  }, [gameEnded]);

  const openBox = (boxId: number) => {
    if (gameEnded) return;

    // Play the chest opening sound effect if the box is still closed (evil laugh for a skeleton)
    const targetBox = boxes.find(box => box.id === boxId);
    if (targetBox && !targetBox.isOpen) {
      new Audio(targetBox.hasTreasure ? chestOpenSound : evilLaughSound).play();
    }

    setBoxes(prevBoxes => {
      const updatedBoxes = prevBoxes.map(box => {
        if (box.id === boxId && !box.isOpen) {
          const newScore = box.hasTreasure ? score + 150 : score - 50;
          setScore(newScore);
          return { ...box, isOpen: true };
        }
        return box;
      });
      
      // Check if treasure is found or all boxes are opened
      const treasureFound = updatedBoxes.some(box => box.isOpen && box.hasTreasure);
      const allOpened = updatedBoxes.every(box => box.isOpen);
      if (treasureFound || allOpened) {
        setGameEnded(true);
      }
      
      return updatedBoxes;
    });
  };

  const resetGame = () => {
    initializeGame();
  };

  const startPlaying = (next: Player) => {
    setPlayer(next);
    setHistory(null);
    initializeGame();
  };

  const handleSignOut = async () => {
    if (player !== 'guest') await signOut().catch(() => {});
    startPlaying(null);
  };

  if (checkingSession) return null;

  if (!player) {
    return (
      <AuthScreen
        onSignedIn={username => startPlaying({ username })}
        onGuest={() => startPlaying('guest')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex flex-col items-center justify-center p-8 relative">
      {/* Who is playing, with sign out / sign in */}
      <div
        className="absolute text-sm text-amber-800 flex items-center gap-2"
        style={{ top: '1rem', right: '1.5rem' }}
      >
        <span>
          {player === 'guest' ? 'Guest mode — scores not saved' : `Signed in as ${player.username}`}
        </span>
        <button type="button" onClick={handleSignOut} className="underline text-amber-900 cursor-pointer">
          {player === 'guest' ? 'Sign in' : 'Sign out'}
        </button>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-4xl mb-4 text-amber-900">🏴‍☠️ Treasure Hunt Game 🏴‍☠️</h1>
        <p className="text-amber-800 mb-4">
          Click on the treasure chests to discover what's inside!
        </p>
        <p className="text-amber-700 text-sm">
          💰 Treasure: +$150 | 💀 Skeleton: -$50
        </p>
      </div>

      <div className="mb-8 relative">
        <div className="text-2xl text-center p-4 bg-amber-200/80 backdrop-blur-sm rounded-lg shadow-lg border-2 border-amber-400">
          <span className="text-amber-900">Current Score: </span>
          <span className={`${score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${score}
          </span>
        </div>

        {/* Show win / tie / loss to the right of the score once the game ends */}
        {gameEnded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: '-50%' }}
            transition={{ duration: 0.4 }}
            style={{ left: '100%', top: '50%', marginLeft: '2rem' }}
            className={`absolute whitespace-nowrap text-2xl p-4 rounded-lg shadow-lg border-2 ${
              score > 0
                ? 'bg-green-100 text-green-800 border-green-300'
                : score === 0
                  ? 'bg-amber-200/80 text-amber-900 border-amber-400'
                  : 'bg-red-100 text-red-800 border-red-300'
            }`}
          >
            {score > 0 ? '🏆 Win!' : score === 0 ? '🤝 Tie' : '💀 Loss'}
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {boxes.map((box) => (
              <motion.div
                key={box.id}
                className="flex flex-col items-center cursor-pointer"
                // Show the key icon as the cursor over closed chests
                style={box.isOpen ? undefined : { cursor: `url(${keyCursor}) 8 8, pointer` }}
                whileHover={{ scale: box.isOpen ? 1 : 1.05 }}
                whileTap={{ scale: box.isOpen ? 1 : 0.95 }}
                onClick={() => openBox(box.id)}
              >
                <motion.div
                  initial={{ rotateY: 0 }}
                  animate={{ 
                    rotateY: box.isOpen ? 180 : 0,
                    scale: box.isOpen ? 1.1 : 1
                  }}
                  transition={{ 
                    duration: 0.6,
                    ease: "easeInOut"
                  }}
                  className="relative"
                >
                  <img
                    src={box.isOpen 
                      ? (box.hasTreasure ? treasureChest : skeletonChest)
                      : closedChest
                    }
                    alt={box.isOpen 
                      ? (box.hasTreasure ? "Treasure!" : "Skeleton!")
                      : "Treasure Chest"
                    }
                    className="w-48 h-48 object-contain drop-shadow-lg"
                  />
                  
                  {box.isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="absolute -top-8 left-1/2 transform -translate-x-1/2"
                    >
                      {box.hasTreasure ? (
                        <div className="text-2xl animate-bounce">✨💰✨</div>
                      ) : (
                        <div className="text-2xl animate-pulse">💀👻💀</div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
                
                <div className="mt-4 text-center">
                  {box.isOpen ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                      className={`text-lg p-2 rounded-lg ${
                        box.hasTreasure 
                          ? 'bg-green-100 text-green-800 border border-green-300' 
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}
                    >
                      {box.hasTreasure ? '+$150' : '-$50'}
                    </motion.div>
                  ) : (
                    <div className="text-amber-700 p-2">
                      Click to open!
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
      </div>

      {gameEnded && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div className="mb-4 p-6 bg-amber-200/80 backdrop-blur-sm rounded-xl shadow-lg border-2 border-amber-400">
                <h2 className="text-2xl mb-2 text-amber-900">Game Over!</h2>
                <p className="text-lg text-amber-800">
                  Final Score: <span className={`${score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${score}
                  </span>
                </p>
                <p className="text-sm text-amber-600 mt-2">
                  {boxes.some(box => box.isOpen && box.hasTreasure) 
                    ? 'Treasure found! Well done, treasure hunter! 🎉' 
                    : 'No treasure found this time! Better luck next time! 💀'}
                </p>
                {player !== 'guest' && history && (
                  <p className="text-sm text-amber-800 mt-2">
                    Best: ${history.best ?? 0} · Games played: {history.games} · Recent:{' '}
                    {history.recent.map(r => `$${r.score}`).join(', ')}
                  </p>
                )}
              </div>
              
              <Button 
                onClick={resetGame}
                className="text-lg px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white"
              >
                Play Again
              </Button>
            </motion.div>
          )}
    </div>
  );
}
