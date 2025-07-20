import React, { useEffect, useRef, useState } from "react";
import "./NumPadSoundGame.css";

// Key/tone/earcon mappings
const NUMPAD_LAYOUT = [7, 8, 9, 4, 5, 6, 1, 2, 3, 0];
const NUMPAD_KEY_CODES = {
  Numpad0: 0, Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4,
  Numpad5: 5, Numpad6: 6, Numpad7: 7, Numpad8: 8, Numpad9: 9,
};
const TONES = [261, 293, 329, 349, 392, 440, 493, 523, 587, 659];
const EARCON = { error: 130, success: 988, notify: 523 };

// Set total number of levels for progress bar (e.g. 20 or ∞ for endless)
const MAX_LEVEL = 20; // Or Infinity for "endless" mode

function playTone(freq, dur = 320) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur / 1000);
  osc.onended = () => ctx.close();
}

function speak(txt, cb) {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const u = new window.SpeechSynthesisUtterance(txt);
    if (cb) u.onend = cb;
    window.speechSynthesis.speak(u);
  }
}
function randomSeq(len) {
  return Array(len)
    .fill()
    .map(() => Math.floor(Math.random() * 10));
}

export default function NumPadSoundGame() {
  const [stage, setStage] = useState("welcome");
  const [level, setLevel] = useState(1);
  const [seq, setSeq] = useState([]);
  const [userIn, setUserIn] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [activeKey, setActiveKey] = useState(null);
  const [showError, setShowError] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(true);

  // SCORING & TRACKING ----------------------------------------------------
  const [score, setScore] = useState(0);
  // Optionally: session high score (not persistent):
  // const [highScore, setHighScore] = useState(0);

  // If user failed the round, track that this round is no longer a candidate for scoring (only on first try)
  const [roundAttempted, setRoundAttempted] = useState(false);
  const seqIdx = useRef(0);

  useEffect(() => {
    if (stage === "welcome") {
      speak(
        "Welcome to NumPad Echo: a sound and memory game for everyone! " +
        "Press Enter or Space to begin, or H for help."
      );
    }
    if (stage === "intro") {
      speak(
        "Interactive introduction. Press any numpad key from zero to nine to hear its name and sound. " +
        "Press Enter or Space when ready to play the game. H for help."
      );
    }
  }, [stage]);


  useEffect(() => {
    function onKey(e) {
      // HELP EVERYWHERE
      if (e.key.toLowerCase() === "h") {
        playTone(EARCON.notify, 120);
        speak(
          "Instructions. Play using your keyboard only. " +
          "During intro: press numpad keys to learn each sound; press Enter or Space to start the game. " +
          `Current score: ${score}. Progress: Level ${level} of ${MAX_LEVEL}. ` +
          "In game: Listen and repeat sequences using your numpad. R replays the sequence, I for intro, H for help, Enter or Space to continue."
        );
        return;
      }

      // INTERACTIVE INTRO
      if (stage === "intro") {
        if (NUMPAD_KEY_CODES[e.code] !== undefined) {
          const n = NUMPAD_KEY_CODES[e.code];
          setActiveKey(n);
          speak("Key " + n, () => {
            playTone(TONES[n]);
            setTimeout(() => setActiveKey(null), 280);
          });
        } else if (e.key === "Enter" || e.code === "Space") {
          setFeedback("");
          setLevel(1);
          setUserIn([]);
          setScore(0);            // <-- Reset score when starting!
          setRoundAttempted(false);
          setStage("wait");
          speak(
            "The introduction is complete. Ready for Level 1. " +
            "Press Enter or Space to hear your first sequence."
          );
        }
      }
      // WELCOME SCREEN
      else if (stage === "welcome") {
        if (e.key === "Enter" || e.code === "Space") {
          setStage("intro");
        }
      }
      // WAIT FOR NEXT LEVEL
      else if (stage === "wait") {
        if (e.key === "Enter" || e.code === "Space") {
          const s = randomSeq(level);
          setSeq(s);
          setUserIn([]);
          setFeedback("");
          setRoundAttempted(false);  // <-- Mark fresh attempt
          playSequence(s, () => {
            setStage("user");
            speak(
              `Your turn. Use the numpad to repeat the ${level} number sequence. R to replay, I for intro, H for help.`
            );
          });
        }
        if (e.key.toLowerCase() === "i") {
          setStage("intro");
        }
      }
      // PLAYING SEQUENCE (No visual hint!)
      else if (stage === "playseq") {
        if (e.key.toLowerCase() === "i") setStage("intro");
      }
      // USER INPUT
      else if (stage === "user") {
        const n = NUMPAD_KEY_CODES[e.code];
        if (typeof n === "number") {
          setActiveKey(n);
          playTone(TONES[n], 180);
          setTimeout(() => setActiveKey(null), 190);
          setUserIn((inputSoFar) => {
            const upd = [...inputSoFar, n];
            if (upd.length === seq.length) {
              let correct = upd.every((v, i) => v === seq[i]);
              setStage("feedback");
              setLastCorrect(correct);

              if (correct) {
                if (!roundAttempted) {
                  // Only increment score if first attempt at this sequence!
                  setScore((score) => {
                    const newScore = score + 1;
                    speak(`Correct! Your score is now ${newScore}. Well done. Press Enter or Space for next level. H for help.`);
                    return newScore;
                  });
                } else {
                  // Already failed before, just feedback
                  speak("Correct! Press Enter or Space for the next level. H for help.");
                }
                playTone(EARCON.success, 250);
                setFeedback("Correct!");
              } else {
                playTone(EARCON.error, 320);
                setFeedback("Incorrect. Try again.");
                setShowError(true);
                setTimeout(() => setShowError(false), 1200);
                setRoundAttempted(true); // Mark that this round is no longer "first try"
                speak(
                  "That was not correct. R to replay sequence, I for intro. Press Enter or Space to retry this level."
                );
              }
            }
            return upd;
          });
        }
        else if (e.key.toLowerCase() === "r") {
          playTone(EARCON.notify, 120);
          playSequence(seq, () => {
            speak("Repeat the sequence now.");
          });
          setUserIn([]);
        } else if (e.key.toLowerCase() === "i") {
          setStage("intro");
        }
      }
      // FEEDBACK: advance only if correct; fix R/I shortcuts
      else if (stage === "feedback") {
        if (e.key.toLowerCase() === "r") {
          playTone(EARCON.notify, 120);
          playSequence(seq, () => {
            speak("Repeat the sequence now.");
          });
          setUserIn([]);
          setStage("user");
        }
        else if (e.key.toLowerCase() === "i") {
          setStage("intro");
        }
        else if (e.key === "Enter" || e.code === "Space") {
          if (lastCorrect) {
            setUserIn([]);
            setFeedback("");
            setLevel((l) => {
              if (l < MAX_LEVEL) return l + 1;
              // If max level reached:
              speak(
                `Congratulations! You've reached the final level. Your score: ${score}. Press I for a new game or H for help.`
              );
              return l;
            });
            setStage("wait");
            if (level < MAX_LEVEL) {
              speak(
                `Ready for Level ${level + 1}. Press Enter or Space for your sequence.`
              );
            }
          } else {
            setUserIn([]);
            setFeedback("");
            setStage("wait");
            speak(
              `Try Level ${level} again. Press Enter or Space for the sequence.`
            );
          }
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, seq, userIn, level, lastCorrect, roundAttempted, score]);

  // *** Sequence playback (NO activeKey - no visual hint!) ***
  function playSequence(s = seq, cb) {
    setStage("playseq");
    speak("Listen to the sequence.", () => {
      seqIdx.current = 0;
      const next = () => {
        if (seqIdx.current < s.length) {
          const num = s[seqIdx.current];
          playTone(TONES[num], 380);
          setTimeout(() => {
            seqIdx.current++;
            setTimeout(next, 180);
          }, 400);
        } else {
          cb && cb();
        }
      };
      next();
    });
  }

  // Progress as percent
  const progress = Math.min((level - 1) / (MAX_LEVEL - 1), 1);

  return (
    <div className="numpad-game-root">
      <h1 style={{ position: "absolute", left: "-9999px" }}>
        NumPad Echo: Blind-friendly Sound Memory Game
      </h1>

      <div className="score-bar-container" aria-label={`Score: ${score}, Level: ${level} of ${MAX_LEVEL}`}>
        <div className="score-badge">
          <span role="img" aria-label="star">⭐</span> Score: <b>{score}</b>
        </div>
        <div className="progress-label">Level {level} of {MAX_LEVEL}</div>
        <div className="progress-bar" aria-hidden="true">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.max(progress * 100, 4)}%` }}
          />
        </div>
      </div>

      <div
        aria-live="polite"
        className="game-status"
        tabIndex={-1}
      >
        {stage === "welcome" ? (
          <span>Welcome! Press Enter or Space to start, H for help.</span>
        ) : stage === "intro" ? (
          <span>
            <b>INTRO:</b> Press numpad keys (0-9) to hear their names and sounds.<br />
            Enter or Space to begin, H for help.
          </span>
        ) : stage === "wait" ? (
          <span>
            Ready for level {level}. Press Enter or Space to play the next sequence.<br />
            I for key intro, H for help.
          </span>
        ) : stage === "playseq" ? (
          <span>
            Sequence playing…<br />
            (Listen carefully!)
          </span>
        ) : stage === "user" ? (
          <span>
            <b>Your Input:</b> {userIn.length ? userIn.join(" ") : "None yet."}<br />
            Use numpad keys. R to replay, I for intro, H for help.
          </span>
        ) : stage === "feedback" ? (
          <span>{feedback}</span>
        ) : null}
      </div>
      <div className={`numpad-container${showError ? " error" : ""}`} aria-hidden="false">
        {NUMPAD_LAYOUT.map((n) => (
          <div
            key={n}
            className={[
              "numpad-key",
              activeKey === n ? "active" : "",
              userIn.includes(n) ? "user-press" : ""
            ].join(" ")}
            aria-label={`Key ${n}`}
            tabIndex={-1}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}
