import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { useAuth } from '../auth/AuthContext';

type GameQuestion = {
  reference: string;
  textWithBlank: string;
  answer: string;
  choices: string[];
};

type LeaderboardItem = {
  rank: number;
  userId: string;
  name: string;
  score: number;
  survivalMs: number;
  correctCount: number;
  tier: string;
  updatedAt: number;
};

type MyBest = {
  score: number;
  survivalMs: number;
  correctCount: number;
  tier: string;
  updatedAt: number | null;
};

type Faller = {
  id: string;
  word: string;
  isAnswer: boolean;
  x: number;
  y: number;
  speed: number;
  spawnAt: number;
};

type FaceState = 'idle' | 'happy' | 'hurt';
type GameStatus = 'idle' | 'loading' | 'running' | 'transition' | 'gameover';
type LeaderboardScope = 'day' | 'week' | 'all';

const STAGE_HEIGHT = 452;
const GROUND_HEIGHT = 54;
const ROUND_DELAYS = [0, 620, 1240, 1860];
const BGM_AUDIO_LOCAL_URL = '/audio/Bike_Rides.mp3';
const BGM_AUDIO_FALLBACK_URL = 'https://www.genspark.ai/api/files/s/5407aOqj';
const MAX_HEARTS = 3;

export default function BibleGamePage() {
  const { me } = useAuth();

  const stageRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const queuedQuestionRef = useRef<GameQuestion | null>(null);
  const prefetchingRef = useRef(false);
  const runTokenRef = useRef(0);
  const startedAtRef = useRef(0);
  const stageWidthRef = useRef(390);
  const playerXRef = useRef(195);
  const elapsedRef = useRef(0);
  const scoreRef = useRef(0);
  const correctCountRef = useRef(0);
  const heartsRef = useRef(MAX_HEARTS);
  const fallersRef = useRef<Faller[]>([]);
  const statusRef = useRef<GameStatus>('idle');

  const [question, setQuestion] = useState<GameQuestion | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [myBest, setMyBest] = useState<MyBest>({ score: 0, survivalMs: 0, correctCount: 0, tier: '씨앗', updatedAt: null });
  const [metaLoading, setMetaLoading] = useState(true);
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [fallers, setFallers] = useState<Faller[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [playerX, setPlayerX] = useState(195);
  const [stageWidth, setStageWidth] = useState(390);
  const [faceState, setFaceState] = useState<FaceState>('idle');
  const [mouthOpen, setMouthOpen] = useState(false);
  const [statusText, setStatusText] = useState('시작 버튼을 누르면 무한 성경 퀴즈가 시작됩니다.');
  const [submittingScore, setSubmittingScore] = useState(false);
  const [feedbackTone, setFeedbackTone] = useState<'idle' | 'success' | 'danger'>('idle');
  const [floatingFeedback, setFloatingFeedback] = useState<{ id: number; text: string; tone: 'success' | 'danger' } | null>(null);
  const [infoTab, setInfoTab] = useState<'leaderboard' | 'guide'>('leaderboard');
  const [leaderboardScope, setLeaderboardScope] = useState<LeaderboardScope>('week');
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [tierNotice, setTierNotice] = useState<string | null>(null);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const prevTierRef = useRef<string>('씨앗');
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmUnlockedRef = useRef(false);
  const bgmFallbackTriedRef = useRef(false);

  const difficulty = useMemo(() => getDifficulty(elapsedMs, correctCount), [elapsedMs, correctCount]);
  const playerMetrics = useMemo(() => getPlayerMetrics(stageWidth, elapsedMs, correctCount), [stageWidth, elapsedMs, correctCount]);
  const currentTier = useMemo(() => getTierBySurvivalMs(elapsedMs), [elapsedMs]);
  const tierPalette = useMemo(() => getTierPalette(currentTier), [currentTier]);

  const syncStatus = useCallback((value: GameStatus) => {
    statusRef.current = value;
    setGameStatus(value);
  }, []);

  const syncScore = useCallback((value: number) => {
    scoreRef.current = value;
    setScore(value);
  }, []);

  const syncElapsed = useCallback((value: number) => {
    elapsedRef.current = value;
    setElapsedMs(value);
  }, []);

  const syncCorrectCount = useCallback((value: number) => {
    correctCountRef.current = value;
    setCorrectCount(value);
  }, []);

  const syncHearts = useCallback((value: number) => {
    heartsRef.current = value;
    setHearts(value);
  }, []);

  const syncPlayerX = useCallback((value: number) => {
    playerXRef.current = value;
    setPlayerX(value);
  }, []);

  const syncFallers = useCallback((items: Faller[]) => {
    fallersRef.current = items;
    setFallers(items);
  }, []);

  const measureStage = useCallback(() => {
    const width = Math.max(320, Math.min(stageRef.current?.clientWidth ?? 390, 430));
    stageWidthRef.current = width;
    setStageWidth(width);
    syncPlayerX(clamp(playerXRef.current || width / 2, 28, width - 28));
  }, [syncPlayerX]);

  const fetchQuestion = useCallback(async () => {
    const res = await apiFetch('/api/bible-game/question');
    if (!res.ok) throw new Error('QUESTION_LOAD_FAILED');
    return (await res.json()) as GameQuestion;
  }, []);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const [leaderboardRes, myBestRes] = await Promise.all([
        apiFetch(`/api/bible-game/leaderboard?scope=${leaderboardScope}`),
        apiFetch('/api/bible-game/my-best')
      ]);
      if (leaderboardRes.ok) setLeaderboard(await leaderboardRes.json());
      if (myBestRes.ok) setMyBest(await myBestRes.json());
    } finally {
      setMetaLoading(false);
    }
  }, [leaderboardScope]);

  const prefetchQuestion = useCallback(async () => {
    if (prefetchingRef.current || queuedQuestionRef.current) return;
    prefetchingRef.current = true;
    try {
      queuedQuestionRef.current = await fetchQuestion();
    } catch {
      queuedQuestionRef.current = null;
    } finally {
      prefetchingRef.current = false;
    }
  }, [fetchQuestion]);

  const clearLoopArtifacts = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    measureStage();
    prefetchQuestion();

    const onResize = () => measureStage();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearLoopArtifacts();
    };
  }, [clearLoopArtifacts, measureStage, prefetchQuestion]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (feedbackTone === 'idle' && !floatingFeedback) return;

    const toneTimer = window.setTimeout(() => setFeedbackTone('idle'), feedbackTone === 'danger' ? 420 : 320);
    const floatingTimer = floatingFeedback ? window.setTimeout(() => setFloatingFeedback(null), 900) : null;

    return () => {
      window.clearTimeout(toneTimer);
      if (floatingTimer) window.clearTimeout(floatingTimer);
    };
  }, [feedbackTone, floatingFeedback]);

  useEffect(() => {
    if (gameStatus !== 'running') {
      prevTierRef.current = currentTier;
      return;
    }

    if (prevTierRef.current !== currentTier) {
      setTierNotice(`${currentTier} 티어 달성!`);
      if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in window.navigator) {
        window.navigator.vibrate([30, 50, 30]);
      }
      const timer = window.setTimeout(() => setTierNotice(null), 1400);
      prevTierRef.current = currentTier;
      return () => window.clearTimeout(timer);
    }
  }, [currentTier, gameStatus]);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window === 'undefined') return;
    if (!('navigator' in window) || !('vibrate' in window.navigator)) return;
    window.navigator.vibrate(pattern);
  }, []);

  const ensureBgmAudio = useCallback(() => {
    if (typeof window === 'undefined') return null;

    let audio = bgmAudioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0.34;
      audio.setAttribute('playsinline', 'true');
      audio.src = BGM_AUDIO_LOCAL_URL;
      audio.addEventListener('error', () => {
        if (bgmFallbackTriedRef.current) return;
        bgmFallbackTriedRef.current = true;
        audio!.src = BGM_AUDIO_FALLBACK_URL;
        audio!.load();
      });
      audio.load();
      bgmAudioRef.current = audio;
    }

    return audio;
  }, []);

  const stopBgm = useCallback(() => {
    const audio = bgmAudioRef.current;
    if (!audio) return;
    audio.pause();
  }, []);

  const startBgm = useCallback(async (unlock = false) => {
    if (typeof window === 'undefined') return;
    if (!bgmEnabled) return;

    const audio = ensureBgmAudio();
    if (!audio) return;
    if (unlock) bgmUnlockedRef.current = true;

    try {
      audio.volume = 0.34;
      if (audio.readyState < 2) {
        audio.load();
      }
      await audio.play();
    } catch {
      if (!bgmFallbackTriedRef.current) {
        bgmFallbackTriedRef.current = true;
        try {
          audio.src = BGM_AUDIO_FALLBACK_URL;
          audio.load();
          await audio.play();
          return;
        } catch {
          // ignore secondary failure
        }
      }
    }
  }, [bgmEnabled, ensureBgmAudio]);

  useEffect(() => {
    if (bgmEnabled && bgmUnlockedRef.current && gameStatus !== 'gameover') {
      void startBgm(true);
      return;
    }

    stopBgm();
  }, [bgmEnabled, gameStatus, startBgm, stopBgm]);

  useEffect(() => {
    const audio = ensureBgmAudio();
    return () => {
      stopBgm();
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      bgmAudioRef.current = null;
    };
  }, [ensureBgmAudio, stopBgm]);

  const playSuccessSound = useCallback(() => {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + index * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.07, now + index * 0.05 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.05 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + index * 0.05);
        osc.stop(now + index * 0.05 + 0.2);
      });
    } catch {
      // ignore
    }
  }, []);

  const playFailSound = useCallback(() => {
    stopBgm();
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // ignore
    }
  }, [stopBgm]);

  const beginRound = useCallback(
    (nextQuestion: GameQuestion, runToken: number) => {
      if (runTokenRef.current !== runToken) return;

      const now = performance.now();
      const words = shuffleArray([...nextQuestion.choices]);
      const closenessOffset = Math.min(18, elapsedRef.current / 26000 + correctCountRef.current * 0.35);
      const laneXs = createLaneCenters(stageWidthRef.current, words.length);

      const nextFallers = words.map((word, index) => ({
        id: `${now}-${word}-${index}`,
        word,
        isAnswer: word === nextQuestion.answer,
        x: laneXs[index],
        y: -40 + closenessOffset,
        speed: 0.068 + index * 0.0048 + Math.min(0.026, elapsedRef.current / 340000),
        spawnAt: now + ROUND_DELAYS[index]
      }));

      setQuestion(nextQuestion);
      syncFallers(nextFallers);
      syncStatus('running');
      setFaceState('idle');
      setMouthOpen(false);
      setStatusText('화면 안쪽 퀴즈를 보며 정답 단어를 철수의 입으로 받아 주세요.');
      prefetchQuestion();
    },
    [prefetchQuestion, syncFallers, syncStatus]
  );

  const finishGame = useCallback(
    async (reason: 'wrong' | 'miss' | 'error', token = runTokenRef.current) => {
      if (token !== runTokenRef.current || statusRef.current === 'gameover') return;

      clearLoopArtifacts();
      syncStatus('gameover');
      syncFallers([]);
      setFaceState('hurt');
      setMouthOpen(false);
      setCombo(0);
      setFeedbackTone('danger');
      setFloatingFeedback({
        id: Date.now(),
        text: reason === 'wrong' ? '오답!' : reason === 'miss' ? '놓쳤어요!' : '오류',
        tone: 'danger'
      });
      setStatusText(
        reason === 'miss'
          ? '정답 단어를 놓쳤어요. 다시 도전해 보세요.'
          : reason === 'wrong'
            ? '오답을 먹어서 철수가 멍들었어요.'
            : '문제를 불러오지 못해 게임을 종료했어요.'
      );
      playFailSound();
      vibrate([40, 60, 90]);

      if (elapsedRef.current <= 0) return;

      setSubmittingScore(true);
      try {
        const res = await apiFetch('/api/bible-game/score', {
          method: 'POST',
          body: JSON.stringify({
            score: scoreRef.current,
            survivalMs: elapsedRef.current,
            correctCount: correctCountRef.current
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.improved) {
            setStatusText(`최고 기록 갱신! 현재 티어는 ${data.tier}입니다.`);
          }
        }
      } catch {
        // ignore
      } finally {
        setSubmittingScore(false);
        await loadMeta();
      }
    },
    [clearLoopArtifacts, loadMeta, playFailSound, syncFallers, syncStatus, vibrate]
  );

  const advanceAfterCorrect = useCallback(async () => {
    const token = runTokenRef.current;
    try {
      const nextQuestion = queuedQuestionRef.current ?? (await fetchQuestion());
      queuedQuestionRef.current = null;
      if (runTokenRef.current !== token) return;
      beginRound(nextQuestion, token);
    } catch {
      await finishGame('error', token);
    }
  }, [beginRound, fetchQuestion, finishGame]);

  const handlePenaltyHit = useCallback(
    (reason: 'wrong' | 'miss', token = runTokenRef.current) => {
      if (statusRef.current !== 'running' || token !== runTokenRef.current) return;

      const nextHearts = heartsRef.current - 1;
      if (nextHearts <= 0) {
        syncHearts(0);
        void finishGame(reason, token);
        return;
      }

      clearLoopArtifacts();
      syncStatus('transition');
      syncFallers([]);
      syncHearts(nextHearts);
      setFaceState('hurt');
      setMouthOpen(false);
      setCombo(0);
      setFeedbackTone('danger');
      setFloatingFeedback({
        id: Date.now(),
        text: reason === 'wrong' ? '오답! 하트 -1' : '놓쳤어요! 하트 -1',
        tone: 'danger'
      });
      setStatusText(
        reason === 'wrong'
          ? `오답을 먹었지만 아직 기회가 있어요. (${nextHearts}/${MAX_HEARTS})`
          : `정답 단어를 놓쳤지만 아직 기회가 있어요. (${nextHearts}/${MAX_HEARTS})`
      );
      playFailSound();
      vibrate([28, 48, 28]);

      transitionTimerRef.current = window.setTimeout(() => {
        if (runTokenRef.current !== token) return;
        setFaceState('idle');
        setMouthOpen(false);
        void startBgm();
        void advanceAfterCorrect();
      }, 520);
    },
    [advanceAfterCorrect, clearLoopArtifacts, finishGame, playFailSound, startBgm, syncFallers, syncHearts, syncStatus, vibrate]
  );

  const handleCorrectCatch = useCallback(() => {
    if (statusRef.current !== 'running') return;

    clearLoopArtifacts();
    syncStatus('transition');
    syncFallers([]);
    setFaceState('happy');
    setMouthOpen(true);
    playSuccessSound();

    const nextCorrect = correctCountRef.current + 1;
    const bonus = 90 + nextCorrect * 12 + Math.floor(elapsedRef.current / 1000) * 3;
    const nextCombo = combo + 1;
    syncCorrectCount(nextCorrect);
    syncScore(scoreRef.current + bonus);
    setCombo(nextCombo);
    setBestCombo((current) => Math.max(current, nextCombo));
    setFeedbackTone('success');
    setFloatingFeedback({
      id: Date.now(),
      text: nextCombo >= 2 ? `콤보 x${nextCombo}!` : '정답!',
      tone: 'success'
    });
    setStatusText(nextCombo >= 2 ? `좋아요! 콤보 x${nextCombo}` : '정답! 다음 단어를 준비하세요.');
    vibrate(24);

    transitionTimerRef.current = window.setTimeout(() => {
      setFaceState('idle');
      setMouthOpen(false);
      void advanceAfterCorrect();
    }, 620);
  }, [advanceAfterCorrect, clearLoopArtifacts, combo, playSuccessSound, syncCorrectCount, syncFallers, syncScore, syncStatus, vibrate]);

  const startLoop = useCallback(() => {
    clearLoopArtifacts();
    let prev = performance.now();

    const tick = () => {
      if (statusRef.current !== 'running') return;

      const now = performance.now();
      const delta = now - prev;
      prev = now;

      const activeToken = runTokenRef.current;
      const nextElapsed = Math.max(0, Math.floor(now - startedAtRef.current));
      syncElapsed(nextElapsed);

      const nextDifficulty = getDifficulty(nextElapsed, correctCountRef.current);
      const nextPlayerMetrics = getPlayerMetrics(stageWidthRef.current, nextElapsed, correctCountRef.current);
      const playerCenterX = playerXRef.current;
      const playerTop = STAGE_HEIGHT - GROUND_HEIGHT - nextPlayerMetrics.height;

      let sawCatch = false;
      let nextMouthOpen = false;
      const nextFallers: Faller[] = [];

      for (const item of fallersRef.current) {
        if (now < item.spawnAt) {
          nextFallers.push(item);
          continue;
        }

        const moved = { ...item, y: item.y + item.speed * nextDifficulty.speedMultiplier * delta };
        const wordWidth = estimateWordWidth(moved.word);
        const wordHeight = 26;
        const horizontalGap = Math.abs(moved.x - playerCenterX);
        const playerGrowth = clamp((nextPlayerMetrics.width - 82) / 28, 0, 1);
        const catchHorizontalThreshold = Math.max(16, nextPlayerMetrics.width * (0.2 + playerGrowth * 0.03) + wordWidth * 0.2);
        const mouthPreviewThreshold = Math.max(18, nextPlayerMetrics.width * (0.24 + playerGrowth * 0.04));
        const catchStartY = playerTop + nextPlayerMetrics.height * (0.08 + (1 - playerGrowth) * 0.05);
        const catchEndY = STAGE_HEIGHT - GROUND_HEIGHT - wordHeight * 0.24;
        const inCatchHeight = moved.y >= catchStartY && moved.y <= catchEndY;
        const canCatch = horizontalGap <= catchHorizontalThreshold && inCatchHeight;
        const nearMouth = horizontalGap <= mouthPreviewThreshold && moved.y >= playerTop - (78 + nextPlayerMetrics.height * 0.12);

        if (nearMouth) nextMouthOpen = true;

        if (canCatch) {
          sawCatch = true;
          if (moved.isAnswer) {
            handleCorrectCatch();
          } else {
            handlePenaltyHit('wrong', activeToken);
          }
          break;
        }

        if (moved.y >= STAGE_HEIGHT - GROUND_HEIGHT - 6) {
          if (moved.isAnswer) {
            sawCatch = true;
            handlePenaltyHit('miss', activeToken);
            break;
          }
          continue;
        }

        nextFallers.push(moved);
      }

      if (sawCatch) return;

      syncFallers(nextFallers);
      setMouthOpen(nextMouthOpen);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [clearLoopArtifacts, handleCorrectCatch, handlePenaltyHit, syncElapsed, syncFallers]);

  useEffect(() => {
    if (gameStatus === 'running') {
      startLoop();
    }
    return () => {
      if (gameStatus === 'running' && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [gameStatus, startLoop]);

  const startGame = useCallback(async () => {
    clearLoopArtifacts();
    runTokenRef.current += 1;
    const runToken = runTokenRef.current;
    queuedQuestionRef.current = null;

    syncStatus('loading');
    syncScore(0);
    syncElapsed(0);
    syncCorrectCount(0);
    syncHearts(MAX_HEARTS);
    syncFallers([]);
    setFaceState('idle');
    setMouthOpen(false);
    setFeedbackTone('idle');
    setFloatingFeedback(null);
    setCombo(0);
    setBestCombo(0);
    setTierNotice(null);
    prevTierRef.current = '씨앗';
    setStatusText('문제를 준비하고 있어요…');
    syncPlayerX(stageWidthRef.current / 2);
    void startBgm(true);

    try {
      const firstQuestion = queuedQuestionRef.current ?? (await fetchQuestion());
      queuedQuestionRef.current = null;
      if (runTokenRef.current !== runToken) return;
      startedAtRef.current = performance.now();
      beginRound(firstQuestion, runToken);
    } catch {
      syncStatus('idle');
      setStatusText('문제를 불러오지 못했습니다. 다시 시도해 주세요.');
    }
  }, [beginRound, clearLoopArtifacts, fetchQuestion, startBgm, syncCorrectCount, syncElapsed, syncFallers, syncHearts, syncPlayerX, syncScore, syncStatus]);

  const movePlayerToClientX = useCallback(
    (clientX: number) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = clamp(clientX - rect.left, playerMetrics.width * 0.5, rect.width - playerMetrics.width * 0.5);
      syncPlayerX(next);
    },
    [playerMetrics.width, syncPlayerX]
  );

  const formattedElapsed = formatDuration(elapsedMs);
  const bestFormatted = formatDuration(myBest.survivalMs);

  return (
    <div style={page}>
      <style>{`
        @keyframes tierPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,255,255,0.12); }
          50% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(255,255,255,0); }
        }
        @keyframes successBurst {
          0% { opacity: 0; transform: translateY(10px) scale(0.92); }
          15% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-34px) scale(1.05); }
        }
        @keyframes errorShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-7px); }
          40% { transform: translateX(7px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        @keyframes answerGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.78; }
        }
      `}</style>
      <div style={pageInner}>
        <TopBar title="바이블 게임" backTo="/" hideAuthActions />

        <Card pad style={stageCard}>
          <div style={stageHeader}>
            <div style={stageHeaderMain}>
              <div style={sectionEyebrow}>PLAY NOW</div>
            </div>
            <div style={stageActionRow}>
              <button
                type="button"
                style={{
                  ...stageChip,
                  minHeight: 30,
                  padding: '0 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  background: bgmEnabled ? tierPalette.chipBg : 'rgba(255,255,255,0.92)',
                  color: bgmEnabled ? tierPalette.chipText : '#5f7180',
                  borderColor: tierPalette.border
                }}
                onClick={() => {
                  if (!bgmEnabled) {
                    setBgmEnabled(true);
                    void startBgm(true);
                    return;
                  }

                  if (bgmAudioRef.current?.paused) {
                    void startBgm(true);
                    return;
                  }

                  setBgmEnabled(false);
                  stopBgm();
                }}
              >
                {bgmEnabled ? 'BGM ON' : 'BGM OFF'}
              </button>
              <div style={{ ...stageChip, minHeight: 30, padding: '0 10px', fontSize: 11, background: tierPalette.chipBg, color: tierPalette.chipText, borderColor: tierPalette.border }}>{formattedElapsed}</div>
            </div>
          </div>

          <div
            ref={stageRef}
            style={{
              ...stageArea,
              background: stageArea.background,
              borderColor: stageArea.borderColor,
              animation: feedbackTone === 'danger' ? 'errorShake 360ms ease' : undefined,
              boxShadow:
                feedbackTone === 'success'
                  ? `inset 0 1px 0 rgba(255,255,255,0.58), 0 18px 30px ${tierPalette.glow}`
                  : feedbackTone === 'danger'
                    ? 'inset 0 1px 0 rgba(255,255,255,0.58), 0 18px 30px rgba(239,68,68,0.2)'
                    : stageArea.boxShadow
            }}
            onPointerDown={(e) => {
              if (bgmEnabled && gameStatus === 'running') void startBgm(true);
              movePlayerToClientX(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.pointerType === 'touch' || e.buttons > 0) movePlayerToClientX(e.clientX);
            }}
            onTouchStart={(e) => {
              if (bgmEnabled && gameStatus === 'running') void startBgm(true);
              movePlayerToClientX(e.touches[0]?.clientX ?? 0);
            }}
            onTouchMove={(e) => movePlayerToClientX(e.touches[0]?.clientX ?? 0)}
          >
            <div style={{ ...stageAura, background: feedbackTone === 'danger' ? 'radial-gradient(circle at 50% 76%, rgba(239,68,68,0.24), rgba(239,68,68,0) 60%)' : `radial-gradient(circle at 50% 76%, ${tierPalette.glow}, rgba(255,255,255,0) 60%)`, animation: feedbackTone === 'success' ? 'answerGlow 560ms ease 1' : undefined }} />
            <div style={stageTopOverlay}>
              <div style={stageQuestionCard}>
                <div style={stageQuestionLabelRow}>
                  <span style={stageQuestionLabel}>QUIZ</span>
                  <span style={{ ...stageQuestionRef, color: tierPalette.chipText, borderColor: tierPalette.border }}>{question?.reference ?? '랜덤 구절 준비 중'}</span>
                </div>
                <div style={stageQuestionVerse}>{question?.textWithBlank ?? '시작 버튼을 누르면 랜덤 성경 구절이 바로 여기 표시됩니다.'}</div>
              </div>
              <div style={stageHudRow}>
                <div
                  style={{
                    ...stageQuickPill,
                    color: hearts <= 1 ? '#b91c1c' : '#7c3aed',
                    borderColor: hearts <= 1 ? 'rgba(239,68,68,0.26)' : 'rgba(168,85,247,0.24)',
                    background: hearts <= 1 ? 'rgba(254,242,242,0.9)' : 'rgba(245,243,255,0.92)'
                  }}
                >
                  {Array.from({ length: MAX_HEARTS }, (_, index) => (index < hearts ? '❤️' : '🤍')).join(' ')}
                </div>
                <div style={stageQuickPill}>남은 하트 {hearts}/{MAX_HEARTS}</div>
              </div>
            </div>
            {tierNotice ? <div style={{ ...tierNoticeBadge, color: tierPalette.chipText, borderColor: tierPalette.border }}>{tierNotice}</div> : null}
            <div style={cloudA} />
            <div style={cloudB} />
            <div style={cloudC} />
            {floatingFeedback ? (
              <div
                key={floatingFeedback.id}
                style={{
                  ...floatingFeedbackBadge,
                  left: clamp(playerX - 74, 18, Math.max(18, stageWidth - 148)),
                  background: floatingFeedback.tone === 'success' ? 'linear-gradient(180deg, rgba(236,253,245,0.98), rgba(187,247,208,0.94))' : 'linear-gradient(180deg, rgba(254,242,242,0.98), rgba(254,202,202,0.94))',
                  borderColor: floatingFeedback.tone === 'success' ? 'rgba(34,197,94,0.34)' : 'rgba(239,68,68,0.34)',
                  color: floatingFeedback.tone === 'success' ? '#166534' : '#b91c1c'
                }}
              >
                {floatingFeedback.text}
              </div>
            ) : null}

            {fallers.map((item) => (
              <div
                key={item.id}
                style={{
                  ...fallerChip,
                  left: item.x - estimateWordWidth(item.word) / 2,
                  top: item.y,
                  minWidth: estimateWordWidth(item.word),
                  background: item.isAnswer ? 'linear-gradient(180deg, rgba(255,255,255,1), rgba(236,253,245,0.96))' : 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(236,244,255,0.94))',
                  borderColor: item.isAnswer ? 'rgba(34,197,94,0.42)' : 'rgba(188,210,239,0.65)',
                  boxShadow: item.isAnswer ? '0 18px 30px rgba(34,197,94,0.16)' : '0 16px 28px rgba(69,100,130,0.14)',
                  transform: item.isAnswer ? 'scale(1.03)' : 'scale(1)',
                  animation: item.isAnswer ? 'tierPulse 1.2s ease-in-out infinite' : undefined
                }}
              >
                {item.word}
              </div>
            ))}

            <div style={groundBand} />
            <div
              style={{
                ...playerWrap,
                left: playerX - playerMetrics.width / 2,
                width: playerMetrics.width,
                height: playerMetrics.height,
                filter: feedbackTone === 'danger' ? 'drop-shadow(0 12px 18px rgba(239,68,68,0.12))' : 'drop-shadow(0 12px 18px rgba(52,211,153,0.1))'
              }}
            >
              <ChulsooAvatar faceState={faceState} mouthOpen={mouthOpen} />
            </div>

            {gameStatus === 'idle' ? (
              <button
                type="button"
                style={{
                  ...stageStartButton,
                  left: clamp(playerX - 86, 16, Math.max(16, stageWidth - 172)),
                  bottom: GROUND_HEIGHT + playerMetrics.height + 14
                }}
                onClick={() => void startGame()}
              >
                START
              </button>
            ) : null}

            {gameStatus === 'loading' ? (
              <div style={overlayCard}>
                <div style={overlayTitle}>문제 준비 중</div>
                <div style={overlayDesc}>새로운 구절과 단어를 불러오고 있어요.</div>
              </div>
            ) : null}

            {gameStatus === 'gameover' ? (
              <div style={overlayCardDanger}>
                <div style={overlayTitle}>게임 종료</div>
                <div style={overlayDesc}>{statusText}</div>
                <div style={overlayStats}>생존 {formattedElapsed} · 정답 {correctCount}개 · 점수 {score} · 최고 콤보 x{bestCombo}</div>
                <div style={overlayActionRow}>
                  <button type="button" style={overlayPrimaryButton} onClick={() => void startGame()}>다시 시작</button>
                  <button type="button" style={overlaySecondaryButton} onClick={() => setInfoTab('leaderboard')}>랭킹 보기</button>
                </div>
              </div>
            ) : null}
          </div>

        </Card>

        <div style={infoGrid}>
          <Card pad style={heroCard}>
            <div style={leaderboardHeroRow}>
              <div>
                <div style={sectionEyebrow}>CURRENT RUN</div>
                <div style={sectionTitle}>지금 플레이</div>
              </div>
              <div style={{ ...stageChip, background: 'rgba(255,255,255,0.92)', color: tierPalette.chipText, borderColor: tierPalette.border }}>{difficultyLabel(difficulty.speedMultiplier)}</div>
            </div>
            <div style={heroStatGrid}>
              <StatTile label="생존 시간" value={formattedElapsed} hint="현재 러닝 타임" tone="mint" />
              <StatTile label="점수" value={`${score}점`} hint="이번 판 누적 점수" tone="peach" />
              <StatTile label="정답 수" value={`${correctCount}개`} hint="맞힌 단어 수" tone="mint" />
              <StatTile label="콤보" value={`x${combo}`} hint={`최고 콤보 x${bestCombo}`} tone="peach" />
            </div>
          </Card>

          <Card pad style={heroCard}>
            <div style={leaderboardHeroRow}>
              <div>
                <div style={sectionEyebrow}>MY BEST</div>
                <div style={sectionTitle}>내 최고 기록</div>
              </div>
              <div style={{ ...stageChip, background: tierPalette.chipBg, color: tierPalette.chipText, borderColor: tierPalette.border }}>{myBest.tier}</div>
            </div>
            <div style={heroStatGrid}>
              <StatTile label="최고 생존" value={bestFormatted} hint="가장 오래 버틴 기록" tone="mint" />
              <StatTile label="최고 점수" value={`${myBest.score}점`} hint="누적 최고 점수" tone="peach" />
              <StatTile label="최고 정답" value={`${myBest.correctCount}개`} hint="한 판 최다 정답" tone="mint" />
              <StatTile label="최고 티어" value={myBest.tier} hint={myBest.updatedAt ? '현재 최고 기록 기준' : '아직 기록 없음'} tone="peach" />
            </div>
            {submittingScore ? <div style={helperText}>랭킹 반영 중…</div> : null}
          </Card>
        </div>

        <div style={infoTabRow}>
          <button type="button" style={{ ...infoTabButton, ...(infoTab === 'leaderboard' ? infoTabButtonActive : null) }} onClick={() => setInfoTab('leaderboard')}>
            랭킹
          </button>
          <button type="button" style={{ ...infoTabButton, ...(infoTab === 'guide' ? infoTabButtonActive : null) }} onClick={() => setInfoTab('guide')}>
            게임 방법
          </button>
        </div>

        {infoTab === 'leaderboard' ? (
          <Card pad style={sectionCard}>
            <div style={leaderboardHeroRow}>
              <div>
                <div style={sectionEyebrow}>LEADERBOARD</div>
                <div style={sectionTitle}>오래 버티는 순 랭킹</div>
              </div>
              <div style={{ ...stageChip, background: tierPalette.chipBg, color: tierPalette.chipText, borderColor: tierPalette.border }}>TOP 20</div>
            </div>

            <div style={leaderboardSummaryCard}>
              <div style={leaderboardSummaryLabel}>{getLeaderboardScopeLabel(leaderboardScope)} 랭킹 기준</div>
              <div style={leaderboardSummaryValue}>{bestFormatted}</div>
              <div style={leaderboardSummaryMeta}>{myBest.tier} · {myBest.score}점 · 정답 {myBest.correctCount}개</div>
            </div>

            <div style={leaderboardScopeRow}>
              <button type="button" style={{ ...leaderboardScopeButton, ...(leaderboardScope === 'day' ? leaderboardScopeButtonActive : null) }} onClick={() => setLeaderboardScope('day')}>오늘</button>
              <button type="button" style={{ ...leaderboardScopeButton, ...(leaderboardScope === 'week' ? leaderboardScopeButtonActive : null) }} onClick={() => setLeaderboardScope('week')}>이번 주</button>
              <button type="button" style={{ ...leaderboardScopeButton, ...(leaderboardScope === 'all' ? leaderboardScopeButtonActive : null) }} onClick={() => setLeaderboardScope('all')}>전체</button>
            </div>

            {metaLoading ? (
              <div className="glassSkeletonStack">
                <div className="glassSkeletonBlock" style={{ height: 72, borderRadius: 18 }} />
                <div className="glassSkeletonBlock" style={{ height: 72, borderRadius: 18 }} />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="glassEmpty">아직 랭킹이 없습니다. 첫 기록의 주인공이 되어 보세요.</div>
            ) : (
              <div style={leaderboardList}>
                {leaderboard.map((item) => {
                  const accent = getRankAccent(item.rank);
                  return (
                    <div key={item.userId} style={{ ...leaderboardRow, ...(item.userId === me?.id ? leaderboardRowMine : null) }}>
                      <div style={{ ...rankBadge, background: accent.background, color: accent.color }}>{item.rank}</div>
                      <div style={leaderboardMain}>
                        <div style={leaderboardNameRow}>
                          <span style={leaderboardName}>{item.name}</span>
                          <span style={item.rank <= 3 ? metaPillPeach : metaPillMint}>{item.tier}</span>
                          {item.userId === me?.id ? <span style={myRankPill}>ME</span> : null}
                        </div>
                        <div style={leaderboardProgressTrack}>
                          <div style={{ ...leaderboardProgressFill, width: `${Math.max(12, Math.min(100, (item.survivalMs / Math.max(leaderboard[0]?.survivalMs || 1, 1)) * 100))}%` }} />
                        </div>
                        <div style={leaderboardMeta}>생존 {formatDuration(item.survivalMs)} · 정답 {item.correctCount}개 · {item.score}점</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ) : (
          <Card pad style={sectionCard}>
            <div style={sectionEyebrow}>HOW TO PLAY</div>
            <div style={sectionTitle}>게임 규칙</div>
            <div style={ruleList}>
              <RuleLine title="문제" desc="개역개정 성경 구절에서 한 단어가 빈칸 처리됩니다." />
              <RuleLine title="낙하" desc="오답 3개와 정답 1개가 시간차를 두고 위에서 떨어집니다." />
              <RuleLine title="조작" desc="스테이지를 터치하거나 드래그해 철수를 좌우로 움직입니다." />
              <RuleLine title="피드백" desc="정답은 초록 버스트, 오답과 놓침은 붉은 경고 이펙트로 즉시 표시됩니다." />
              <RuleLine title="하트" desc="하트 3개로 시작하며, 오답을 먹거나 정답을 놓칠 때마다 1개씩 차감됩니다." />
              <RuleLine title="성장" desc="시간이 지날수록 철수가 커지고, 단어는 더 빨라지지만 판정은 너무 이르게 나지 않도록 더 타이트하게 조정됩니다." />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function RuleLine({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={ruleLine}>
      <div style={ruleTitle}>{title}</div>
      <div style={ruleDesc}>{desc}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatCard}>
      <div style={miniStatLabel}>{label}</div>
      <div style={miniStatValue}>{value}</div>
    </div>
  );
}

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: 'mint' | 'peach' }) {
  return (
    <div
      style={{
        ...heroStatCard,
        background: tone === 'mint' ? 'rgba(114,215,199,0.14)' : 'rgba(243,180,156,0.16)',
        borderColor: tone === 'mint' ? 'rgba(114,215,199,0.24)' : 'rgba(243,180,156,0.24)'
      }}
    >
      <div style={heroStatLabel}>{label}</div>
      <div style={heroStatValue}>{value}</div>
      <div style={heroStatHint}>{hint}</div>
    </div>
  );
}

function ChulsooAvatar({ faceState, mouthOpen }: { faceState: FaceState; mouthOpen: boolean }) {
  const faceColor = faceState === 'hurt' ? '#ffd5d5' : '#fff3df';
  const blushColor = faceState === 'hurt' ? '#8a4f70' : '#f2b7a0';
  const mouthColor = faceState === 'hurt' ? '#76344f' : '#8a4634';

  return (
    <svg viewBox="0 0 180 150" style={avatarSvg}>
      <ellipse cx="90" cy="128" rx="64" ry="14" fill="rgba(0,0,0,0.1)" />
      <rect x="40" y="58" width="100" height="72" rx="34" fill="#78d9c9" />
      <circle cx="90" cy="55" r="42" fill={faceColor} stroke="rgba(82,78,68,0.18)" strokeWidth="2" />
      <circle cx="75" cy="48" r="4.8" fill="#2a3138" />
      <circle cx="106" cy="48" r="4.8" fill="#2a3138" />
      <ellipse cx="63" cy="58" rx="10" ry="6" fill={blushColor} opacity="0.6" />
      <ellipse cx="117" cy="58" rx="10" ry="6" fill={blushColor} opacity="0.6" />
      {faceState === 'hurt' ? <circle cx="119" cy="38" r="10" fill="rgba(110,92,180,0.35)" /> : null}
      {faceState === 'happy' ? (
        <path d="M72 67c7 9 29 9 36 0" fill="none" stroke={mouthColor} strokeWidth="4.5" strokeLinecap="round" />
      ) : mouthOpen ? (
        <ellipse cx="90" cy="69" rx="15" ry="18" fill={mouthColor} />
      ) : faceState === 'hurt' ? (
        <path d="M73 73c7-5 28-5 34 0" fill="none" stroke={mouthColor} strokeWidth="4.5" strokeLinecap="round" />
      ) : (
        <path d="M77 70c5 3 21 3 26 0" fill="none" stroke={mouthColor} strokeWidth="4" strokeLinecap="round" />
      )}
      <path d="M54 94c8 2 15 10 16 18" fill="none" stroke="#49a99a" strokeWidth="10" strokeLinecap="round" />
      <path d="M126 94c-8 2-15 10-16 18" fill="none" stroke="#49a99a" strokeWidth="10" strokeLinecap="round" />
      <path d="M73 129v-19" fill="none" stroke="#4a9d90" strokeWidth="10" strokeLinecap="round" />
      <path d="M107 129v-19" fill="none" stroke="#4a9d90" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}

function getDifficulty(elapsedMs: number, correctCount: number) {
  return {
    speedMultiplier: 0.68 + Math.min(0.56, elapsedMs / 94000 + correctCount * 0.009),
    playerScale: 1 + Math.min(0.28, elapsedMs / 128000 + correctCount * 0.0065)
  };
}

function getPlayerMetrics(stageWidth: number, elapsedMs: number, correctCount: number) {
  const { playerScale } = getDifficulty(elapsedMs, correctCount);
  const width = Math.min(stageWidth * 0.38, 82 * playerScale + correctCount * 0.35);
  return {
    width,
    height: width * 0.82
  };
}

function getTierBySurvivalMs(ms: number) {
  const sec = Math.floor(ms / 1000);
  if (sec >= 120) return '사도';
  if (sec >= 80) return '다윗';
  if (sec >= 50) return '파수꾼';
  if (sec >= 30) return '제자';
  if (sec >= 15) return '새싹';
  return '씨앗';
}

function getNextTierHint(ms: number) {
  const sec = Math.floor(ms / 1000);
  if (sec < 15) return `새싹까지 ${15 - sec}초`;
  if (sec < 30) return `제자까지 ${30 - sec}초`;
  if (sec < 50) return `파수꾼까지 ${50 - sec}초`;
  if (sec < 80) return `다윗까지 ${80 - sec}초`;
  if (sec < 120) return `사도까지 ${120 - sec}초`;
  return '최고 티어 달성';
}

function getTierProgress(ms: number) {
  const sec = Math.floor(ms / 1000);
  const bands = [
    { start: 0, end: 15, label: '씨앗 → 새싹' },
    { start: 15, end: 30, label: '새싹 → 제자' },
    { start: 30, end: 50, label: '제자 → 파수꾼' },
    { start: 50, end: 80, label: '파수꾼 → 다윗' },
    { start: 80, end: 120, label: '다윗 → 사도' }
  ];

  for (const band of bands) {
    if (sec < band.end) {
      return {
        label: band.label,
        percent: Math.max(8, Math.min(100, ((sec - band.start) / (band.end - band.start)) * 100))
      };
    }
  }

  return { label: '사도 유지 중', percent: 100 };
}

function getLeaderboardScopeLabel(scope: LeaderboardScope) {
  if (scope === 'day') return '오늘';
  if (scope === 'week') return '이번 주';
  return '전체';
}

function getTierPalette(tier: string) {
  switch (tier) {
    case '사도':
      return {
        card: 'linear-gradient(180deg, rgba(255,250,223,0.98), rgba(255,243,206,0.92))',
        border: 'rgba(244,197,66,0.4)',
        chipBg: 'linear-gradient(180deg, rgba(255,252,237,0.96), rgba(250,228,163,0.92))',
        chipText: '#8a5a00',
        glow: 'rgba(244,197,66,0.28)',
        skyTop: '#fff0b8',
        skyBottom: '#ffe9c7'
      };
    case '다윗':
      return {
        card: 'linear-gradient(180deg, rgba(255,242,229,0.98), rgba(255,230,205,0.92))',
        border: 'rgba(249,115,22,0.36)',
        chipBg: 'linear-gradient(180deg, rgba(255,246,237,0.96), rgba(255,212,176,0.92))',
        chipText: '#a24c06',
        glow: 'rgba(249,115,22,0.2)',
        skyTop: '#ffe0bf',
        skyBottom: '#fff1db'
      };
    case '파수꾼':
      return {
        card: 'linear-gradient(180deg, rgba(245,239,255,0.98), rgba(233,225,255,0.92))',
        border: 'rgba(139,92,246,0.34)',
        chipBg: 'linear-gradient(180deg, rgba(250,247,255,0.96), rgba(223,212,255,0.92))',
        chipText: '#6647c2',
        glow: 'rgba(139,92,246,0.2)',
        skyTop: '#eadcff',
        skyBottom: '#f6ecff'
      };
    case '제자':
      return {
        card: 'linear-gradient(180deg, rgba(236,246,255,0.98), rgba(225,239,255,0.92))',
        border: 'rgba(59,130,246,0.32)',
        chipBg: 'linear-gradient(180deg, rgba(244,249,255,0.96), rgba(213,232,255,0.92))',
        chipText: '#2e67c4',
        glow: 'rgba(59,130,246,0.2)',
        skyTop: '#d9efff',
        skyBottom: '#eef7ff'
      };
    case '새싹':
      return {
        card: 'linear-gradient(180deg, rgba(238,251,241,0.98), rgba(225,245,231,0.92))',
        border: 'rgba(34,197,94,0.28)',
        chipBg: 'linear-gradient(180deg, rgba(245,253,247,0.96), rgba(213,244,221,0.92))',
        chipText: '#24774b',
        glow: 'rgba(34,197,94,0.18)',
        skyTop: '#dcf7e3',
        skyBottom: '#edfdf1'
      };
    default:
      return {
        card: 'linear-gradient(180deg, rgba(240,250,248,0.98), rgba(228,247,243,0.92))',
        border: 'rgba(20,184,166,0.26)',
        chipBg: 'linear-gradient(180deg, rgba(245,253,252,0.96), rgba(216,246,240,0.92))',
        chipText: '#1f7a70',
        glow: 'rgba(20,184,166,0.16)',
        skyTop: '#dff8f2',
        skyBottom: '#eefcf8'
      };
  }
}

function getRankAccent(rank: number) {
  if (rank === 1) return { background: 'linear-gradient(180deg, #fff3bf, #ffd86b)', color: '#845700' };
  if (rank === 2) return { background: 'linear-gradient(180deg, #f5f7fb, #d7dde8)', color: '#55606f' };
  if (rank === 3) return { background: 'linear-gradient(180deg, #ffe1cc, #f6b98d)', color: '#8d4a24' };
  return { background: 'rgba(255,255,255,0.9)', color: '#4d6170' };
}

function difficultyLabel(speedMultiplier: number) {
  if (speedMultiplier >= 2.6) return '초고속 말씀 우박';
  if (speedMultiplier >= 2.1) return '고속 말씀 우박';
  if (speedMultiplier >= 1.6) return '집중 구간';
  return '워밍업 구간';
}

function createLaneCenters(width: number, count: number) {
  const lanes = shuffleArray(Array.from({ length: count }, (_, i) => i));
  const usable = width - 70;
  return lanes.map((laneIndex, idx) => {
    const base = 35 + ((laneIndex + 0.5) * usable) / count;
    const jitter = (idx % 2 === 0 ? -1 : 1) * (8 + Math.random() * 10);
    return clamp(base + jitter, 36, width - 36);
  });
}

function estimateWordWidth(word: string) {
  return Math.max(76, Math.min(124, word.length * 14 + 24));
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = String(Math.floor(total / 60)).padStart(2, '0');
  const sec = String(total % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function shuffleArray<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

const page: CSSProperties = {
  minHeight: '100dvh',
  padding: '8px 8px 20px',
  background: 'transparent'
};

const pageInner: CSSProperties = {
  width: '100%',
  maxWidth: 420,
  margin: '0 auto',
  display: 'grid',
  gap: 8
};

const heroCard: CSSProperties = {
  borderRadius: 22,
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-sm)',
  backdropFilter: 'blur(8px)'
};

const badgeMint: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'linear-gradient(180deg, rgba(114,215,199,0.18), rgba(255,255,255,0.92))',
  border: '1px solid rgba(114,215,199,0.28)',
  color: '#227668',
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 8
};

const heroInlinePillRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 10
};

const heroCompactRow: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10
};

const heroCompactMain: CSSProperties = {
  flex: 1,
  minWidth: 0
};

const heroTitleCompact: CSSProperties = {
  color: '#24313a',
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1.28,
  letterSpacing: '-0.02em'
};

const heroCompactMetaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 8
};

const heroCompactMeta: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 26,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(248,252,255,0.92)',
  border: '1px solid rgba(213,228,240,0.92)',
  color: '#4f6472',
  fontSize: 11,
  fontWeight: 900
};

const soundToggleButton: CSSProperties = {
  minWidth: 78,
  minHeight: 42,
  padding: '0 12px',
  borderRadius: 16,
  border: '1px solid rgba(214,232,245,0.92)',
  background: 'rgba(255,255,255,0.88)',
  color: '#486473',
  fontSize: 12,
  fontWeight: 900,
  boxShadow: '0 8px 16px rgba(77,90,110,0.05)',
  cursor: 'pointer'
};

const heroInlinePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(248,252,255,0.92)',
  border: '1px solid rgba(213,228,240,0.92)',
  color: '#4f6472',
  fontSize: 12,
  fontWeight: 800
};

const heroTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 24,
  fontWeight: 800,
  lineHeight: 1.16,
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  marginTop: 6,
  color: '#61707a',
  fontSize: 13,
  lineHeight: 1.55
};

const heroStatGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  marginTop: 12
};

const heroStatCard: CSSProperties = {
  padding: '12px 12px 10px',
  borderRadius: 18,
  border: '1px solid transparent',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42), 0 10px 22px rgba(77,90,110,0.04)'
};

const heroStatLabel: CSSProperties = {
  color: '#6c7881',
  fontSize: 12,
  fontWeight: 700
};

const heroStatValue: CSSProperties = {
  marginTop: 8,
  color: '#24313a',
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.08
};

const heroStatHint: CSSProperties = {
  marginTop: 6,
  color: '#67747d',
  fontSize: 12,
  lineHeight: 1.45
};

const heroActionGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 8,
  marginTop: 12
};

const heroActionGridCompact: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  marginTop: 10
};

const questionCard: CSSProperties = {
  borderRadius: 24,
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-sm)'
};

const sectionEyebrow: CSSProperties = {
  color: '#5e93d6',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const sectionTitle: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 21,
  fontWeight: 800,
  lineHeight: 1.2
};

const sectionTitleCompact: CSSProperties = {
  marginTop: 4,
  color: '#24313a',
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1.2
};

const questionVerse: CSSProperties = {
  marginTop: 10,
  color: '#1f2f41',
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1.6,
  letterSpacing: '-0.02em',
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(226,237,245,0.96)'
};

const questionMetaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12
};

const stageCard: CSSProperties = {
  borderRadius: 24,
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-sm)',
  overflow: 'hidden',
  backdropFilter: 'blur(8px)'
};

const stageQuickBar: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 10
};

const stageTopOverlay: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  right: 12,
  display: 'grid',
  gap: 8,
  zIndex: 2
};

const stageQuestionCard: CSSProperties = {
  padding: '10px 10px 9px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.9)',
  border: '1px solid rgba(255,255,255,0.92)',
  boxShadow: '0 10px 16px rgba(77,90,110,0.06)',
  backdropFilter: 'blur(14px)'
};

const stageQuestionLabelRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap'
};

const stageQuestionLabel: CSSProperties = {
  color: '#5e93d6',
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const stageQuestionRef: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 22,
  padding: '0 8px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(214,231,244,0.9)',
  color: '#4f6472',
  fontSize: 9,
  fontWeight: 900
};

const stageQuestionVerse: CSSProperties = {
  marginTop: 7,
  color: '#1f2f41',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.42,
  letterSpacing: '-0.02em'
};

const stageHudRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6
};

const stageProgressBox: CSSProperties = {
  padding: '9px 10px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(220,231,240,0.9)',
  boxShadow: '0 10px 20px rgba(77,90,110,0.05)'
};

const stageQuickPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.84)',
  border: '1px solid rgba(218,231,241,0.92)',
  color: '#476171',
  fontSize: 12,
  fontWeight: 900,
  boxShadow: '0 8px 18px rgba(77,90,110,0.05)'
};

const tierProgressWrap: CSSProperties = {
  marginBottom: 10,
  padding: '10px 12px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(220,231,240,0.9)',
  boxShadow: '0 10px 20px rgba(77,90,110,0.05)'
};

const tierProgressLabelRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 8
};

const tierProgressLabel: CSSProperties = {
  color: '#5f7180',
  fontSize: 12,
  fontWeight: 800
};

const tierProgressValue: CSSProperties = {
  color: '#2a3b49',
  fontSize: 12,
  fontWeight: 900
};

const tierProgressTrack: CSSProperties = {
  height: 10,
  borderRadius: 999,
  background: 'rgba(223,232,240,0.96)',
  overflow: 'hidden'
};

const tierProgressFill: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  transition: 'width 180ms ease-out'
};

const stageHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 10
};

const stageHeaderMain: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center'
};

const stageActionRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8
};

const stageChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(225,247,241,0.9))',
  border: '1px solid rgba(114,215,199,0.28)',
  color: '#257567',
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: 'nowrap',
  boxShadow: '0 10px 20px rgba(77,90,110,0.06)'
};

const stageArea: CSSProperties = {
  position: 'relative',
  height: STAGE_HEIGHT,
  borderRadius: 22,
  overflow: 'hidden',
  background: 'var(--bg-grad)',
  border: '1px solid var(--border-strong)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.58), 0 12px 24px rgba(0,0,0,0.06)',
  touchAction: 'none',
  userSelect: 'none'
};

const stageAura: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none'
};

const tierNoticeBadge: CSSProperties = {
  position: 'absolute',
  top: 124,
  left: '50%',
  transform: 'translateX(-50%)',
  minHeight: 34,
  padding: '0 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(255,255,255,0.96)',
  boxShadow: '0 18px 28px rgba(31,41,55,0.12)',
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 13,
  fontWeight: 900,
  zIndex: 3,
  animation: 'successBurst 1.2s ease forwards'
};

const stageGuideRow: CSSProperties = {
  position: 'absolute',
  left: 14,
  right: 14,
  bottom: 66,
  display: 'flex',
  justifyContent: 'center',
  gap: 8,
  flexWrap: 'wrap',
  zIndex: 2
};

const stageGuidePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.82)',
  color: '#5b6b77',
  fontSize: 11,
  fontWeight: 900,
  boxShadow: '0 10px 20px rgba(77,90,110,0.06)'
};

const cloudA: CSSProperties = {
  position: 'absolute',
  top: 148,
  left: 18,
  width: 92,
  height: 34,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.72)',
  boxShadow: '28px 8px 0 rgba(255,255,255,0.7), 54px -2px 0 rgba(255,255,255,0.74)'
};

const cloudB: CSSProperties = {
  position: 'absolute',
  top: 182,
  right: 62,
  width: 68,
  height: 24,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.68)',
  boxShadow: '20px 6px 0 rgba(255,255,255,0.65), 38px -2px 0 rgba(255,255,255,0.7)'
};

const cloudC: CSSProperties = {
  position: 'absolute',
  top: 228,
  left: 160,
  width: 74,
  height: 24,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.58)',
  boxShadow: '24px 7px 0 rgba(255,255,255,0.6), 42px 0 0 rgba(255,255,255,0.58)'
};

const fallerChip: CSSProperties = {
  position: 'absolute',
  minHeight: 26,
  padding: '0 8px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 900,
  color: '#223a54',
  border: '1px solid rgba(255,255,255,0.92)',
  boxShadow: '0 10px 16px rgba(69,100,130,0.12)'
};

const groundBand: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: GROUND_HEIGHT,
  background: 'linear-gradient(180deg, #7ce3c6 0%, #40bf96 100%)',
  borderTop: '1px solid rgba(41,148,115,0.45)',
  boxShadow: 'inset 0 12px 18px rgba(255,255,255,0.12)'
};

const playerWrap: CSSProperties = {
  position: 'absolute',
  bottom: 8,
  display: 'grid',
  placeItems: 'center',
  zIndex: 2
};

const stageStartButton: CSSProperties = {
  position: 'absolute',
  minWidth: 172,
  minHeight: 48,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.92)',
  background: 'linear-gradient(180deg, #2fd4c4, #1fb7a9)',
  color: '#ffffff',
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: '0.02em',
  boxShadow: '0 14px 28px rgba(31,184,169,0.24)',
  zIndex: 4,
  cursor: 'pointer'
};

const avatarSvg: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block'
};

const playerLabel: CSSProperties = {
  position: 'absolute',
  bottom: -4,
  padding: '0 10px',
  minHeight: 26,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(255,255,255,0.8)',
  color: '#47626f',
  fontSize: 12,
  fontWeight: 900,
  display: 'inline-flex',
  alignItems: 'center'
};

const overlayCard: CSSProperties = {
  position: 'absolute',
  left: 12,
  right: 12,
  bottom: 12,
  padding: '12px 12px 10px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.9)',
  border: '1px solid rgba(255,255,255,0.92)',
  boxShadow: '0 14px 28px rgba(77,90,110,0.09)',
  backdropFilter: 'blur(14px)',
  zIndex: 4
};

const overlayCardDanger: CSSProperties = {
  ...overlayCard,
  background: 'rgba(255,245,245,0.94)',
  border: '1px solid rgba(235,170,170,0.58)',
  bottom: 10
};

const overlayTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 16,
  fontWeight: 800
};

const overlayDesc: CSSProperties = {
  marginTop: 6,
  color: '#67747d',
  fontSize: 13,
  lineHeight: 1.5
};

const overlayStats: CSSProperties = {
  marginTop: 8,
  color: '#8b5648',
  fontSize: 12,
  fontWeight: 800
};

const overlayActionRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  marginTop: 12
};

const overlayPrimaryButton: CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  border: '1px solid rgba(245,158,11,0.32)',
  background: 'linear-gradient(180deg, #fff5d4, #ffd87a)',
  color: '#7c4b00',
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer'
};

const overlaySecondaryButton: CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  border: '1px solid rgba(203,213,225,0.9)',
  background: 'rgba(255,255,255,0.9)',
  color: '#506273',
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer'
};

const floatingFeedbackBadge: CSSProperties = {
  position: 'absolute',
  top: 96,
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 900,
  border: '1px solid transparent',
  boxShadow: '0 16px 28px rgba(31,41,55,0.12)',
  animation: 'successBurst 900ms ease forwards',
  zIndex: 3
};

const statusBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginTop: 8,
  flexWrap: 'wrap'
};

const statusTextStyle: CSSProperties = {
  color: '#60707a',
  fontSize: 12,
  lineHeight: 1.5,
  flex: 1
};

const statusMeta: CSSProperties = {
  color: '#2c7b6f',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
  padding: '6px 10px',
  borderRadius: 999
};

const infoGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 10
};

const sectionCard: CSSProperties = {
  borderRadius: 24,
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-sm)',
  backdropFilter: 'blur(8px)'
};

const infoTabRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8
};

const infoTabButton: CSSProperties = {
  minHeight: 44,
  borderRadius: 16,
  border: '1px solid rgba(218,231,241,0.9)',
  background: 'rgba(255,255,255,0.86)',
  color: '#576874',
  fontSize: 14,
  fontWeight: 900,
  boxShadow: '0 10px 20px rgba(77,90,110,0.06)',
  cursor: 'pointer'
};

const infoTabButtonActive: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(226,239,255,0.94))',
  color: '#2d67c6',
  border: '1px solid rgba(96,165,250,0.32)'
};

const leaderboardHeroRow: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 10
};

const leaderboardScopeRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
  marginBottom: 10
};

const leaderboardScopeButton: CSSProperties = {
  minHeight: 38,
  borderRadius: 14,
  border: '1px solid rgba(218,231,241,0.9)',
  background: 'rgba(255,255,255,0.9)',
  color: '#5a6f7d',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer'
};

const leaderboardScopeButtonActive: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(236,246,255,0.98), rgba(213,232,255,0.94))',
  border: '1px solid rgba(96,165,250,0.32)',
  color: '#2d67c6',
  boxShadow: '0 12px 20px rgba(96,165,250,0.12)'
};

const leaderboardSummaryCard: CSSProperties = {
  padding: '12px 12px 11px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid var(--border)',
  boxShadow: '0 10px 20px rgba(0,0,0,0.04)',
  marginBottom: 10,
  backdropFilter: 'blur(8px)'
};

const leaderboardSummaryLabel: CSSProperties = {
  color: '#64809b',
  fontSize: 12,
  fontWeight: 800
};

const leaderboardSummaryValue: CSSProperties = {
  marginTop: 6,
  color: '#213444',
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.05
};

const leaderboardSummaryMeta: CSSProperties = {
  marginTop: 6,
  color: '#5e7280',
  fontSize: 12,
  lineHeight: 1.45
};

const leaderboardProgressTrack: CSSProperties = {
  marginTop: 8,
  height: 8,
  borderRadius: 999,
  background: 'rgba(226,236,244,0.96)',
  overflow: 'hidden'
};

const leaderboardProgressFill: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, #34d399 0%, #60a5fa 100%)'
};

const myRankPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 22,
  padding: '0 8px',
  borderRadius: 999,
  background: 'rgba(59,130,246,0.12)',
  color: '#2d67c6',
  fontSize: 11,
  fontWeight: 900
};

const miniStatList: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 10
};

const miniStatCard: CSSProperties = {
  padding: '11px 11px 10px',
  borderRadius: 16,
  background: 'rgba(250,252,255,0.9)',
  border: '1px solid rgba(227,233,237,0.92)',
  boxShadow: '0 8px 18px rgba(77,90,110,0.04)'
};

const miniStatLabel: CSSProperties = {
  color: '#6c7881',
  fontSize: 12,
  fontWeight: 700
};

const miniStatValue: CSSProperties = {
  marginTop: 8,
  color: '#24313a',
  fontSize: 18,
  fontWeight: 800
};

const helperText: CSSProperties = {
  marginTop: 10,
  color: '#7a8790',
  fontSize: 12,
  lineHeight: 1.45
};

const leaderboardList: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 8
};

const leaderboardRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '11px 11px 10px',
  borderRadius: 18,
  background: 'rgba(250,252,255,0.92)',
  border: '1px solid rgba(227,233,237,0.92)',
  boxShadow: '0 8px 18px rgba(77,90,110,0.04)'
};

const leaderboardRowMine: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(114,215,199,0.14), rgba(255,255,255,0.74))',
  border: '1px solid rgba(114,215,199,0.26)'
};

const rankBadge: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(255,255,255,0.84)',
  border: '1px solid rgba(255,255,255,0.88)',
  color: '#4d6170',
  fontSize: 15,
  fontWeight: 900,
  flex: '0 0 40px',
  boxShadow: '0 8px 18px rgba(77,90,110,0.04)'
};

const leaderboardMain: CSSProperties = {
  minWidth: 0,
  flex: 1
};

const leaderboardNameRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
};

const leaderboardName: CSSProperties = {
  color: '#24313a',
  fontSize: 16,
  fontWeight: 800
};

const leaderboardMeta: CSSProperties = {
  marginTop: 6,
  color: '#67747d',
  fontSize: 13,
  lineHeight: 1.45
};

const metaPillMint: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 26,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800
};

const metaPillPeach: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.24)',
  color: '#9d6550',
  fontSize: 12,
  fontWeight: 800
};

const metaPillNeutral: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.62)',
  border: '1px solid rgba(255,255,255,0.72)',
  color: '#6e7b84',
  fontSize: 12,
  fontWeight: 800
};

const ruleList: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 10
};

const ruleLine: CSSProperties = {
  padding: '11px 11px 10px',
  borderRadius: 16,
  background: 'rgba(250,252,255,0.92)',
  border: '1px solid rgba(227,233,237,0.92)',
  boxShadow: '0 8px 18px rgba(77,90,110,0.04)'
};

const ruleTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 14,
  fontWeight: 800
};

const ruleDesc: CSSProperties = {
  marginTop: 6,
  color: '#67747d',
  fontSize: 13,
  lineHeight: 1.5
};
