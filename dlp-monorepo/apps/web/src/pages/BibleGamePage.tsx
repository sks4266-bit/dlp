import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
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

const STAGE_HEIGHT = 430;
const GROUND_HEIGHT = 54;
const ROUND_DELAYS = [0, 260, 520, 780];

export default function BibleGamePage() {
  const nav = useNavigate();
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
  const [playerX, setPlayerX] = useState(195);
  const [stageWidth, setStageWidth] = useState(390);
  const [faceState, setFaceState] = useState<FaceState>('idle');
  const [mouthOpen, setMouthOpen] = useState(false);
  const [statusText, setStatusText] = useState('시작 버튼을 누르면 무한 성경 퀴즈가 시작됩니다.');
  const [submittingScore, setSubmittingScore] = useState(false);

  const difficulty = useMemo(() => getDifficulty(elapsedMs, correctCount), [elapsedMs, correctCount]);
  const playerMetrics = useMemo(() => getPlayerMetrics(stageWidth, elapsedMs, correctCount), [stageWidth, elapsedMs, correctCount]);
  const currentTier = useMemo(() => getTierBySurvivalMs(elapsedMs), [elapsedMs]);

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
      const [leaderboardRes, myBestRes] = await Promise.all([apiFetch('/api/bible-game/leaderboard'), apiFetch('/api/bible-game/my-best')]);
      if (leaderboardRes.ok) setLeaderboard(await leaderboardRes.json());
      if (myBestRes.ok) setMyBest(await myBestRes.json());
    } finally {
      setMetaLoading(false);
    }
  }, []);

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
    loadMeta();
    prefetchQuestion();

    const onResize = () => measureStage();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearLoopArtifacts();
    };
  }, [clearLoopArtifacts, loadMeta, measureStage, prefetchQuestion]);

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
  }, []);

  const beginRound = useCallback(
    (nextQuestion: GameQuestion, runToken: number) => {
      if (runTokenRef.current !== runToken) return;

      const now = performance.now();
      const words = shuffleArray([...nextQuestion.choices]);
      const closenessOffset = Math.min(115, elapsedRef.current / 3500 + correctCountRef.current * 4.5);
      const laneXs = createLaneCenters(stageWidthRef.current, words.length);

      const nextFallers = words.map((word, index) => ({
        id: `${now}-${word}-${index}`,
        word,
        isAnswer: word === nextQuestion.answer,
        x: laneXs[index],
        y: -40 + closenessOffset,
        speed: 0.17 + index * 0.018 + Math.min(0.16, elapsedRef.current / 100000),
        spawnAt: now + ROUND_DELAYS[index]
      }));

      setQuestion(nextQuestion);
      syncFallers(nextFallers);
      syncStatus('running');
      setFaceState('idle');
      setMouthOpen(false);
      setStatusText('정답 단어를 철수의 입으로 받아 주세요.');
      prefetchQuestion();
    },
    [prefetchQuestion, syncFallers, syncStatus]
  );

  const finishGame = useCallback(
    async (reason: 'wrong' | 'miss' | 'error') => {
      if (statusRef.current === 'gameover') return;

      clearLoopArtifacts();
      syncStatus('gameover');
      syncFallers([]);
      setFaceState('hurt');
      setMouthOpen(false);
      setStatusText(
        reason === 'miss'
          ? '정답 단어를 놓쳤어요. 다시 도전해 보세요.'
          : reason === 'wrong'
            ? '오답을 먹어서 철수가 멍들었어요.'
            : '문제를 불러오지 못해 게임을 종료했어요.'
      );
      playFailSound();

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
    [clearLoopArtifacts, loadMeta, playFailSound, syncFallers, syncStatus]
  );

  const advanceAfterCorrect = useCallback(async () => {
    const token = runTokenRef.current;
    try {
      const nextQuestion = queuedQuestionRef.current ?? (await fetchQuestion());
      queuedQuestionRef.current = null;
      if (runTokenRef.current !== token) return;
      beginRound(nextQuestion, token);
    } catch {
      await finishGame('error');
    }
  }, [beginRound, fetchQuestion, finishGame]);

  const handleCorrectCatch = useCallback(() => {
    if (statusRef.current !== 'running') return;

    clearLoopArtifacts();
    syncStatus('transition');
    syncFallers([]);
    setFaceState('happy');
    setMouthOpen(true);
    playSuccessSound();

    const nextCorrect = correctCountRef.current + 1;
    syncCorrectCount(nextCorrect);
    const bonus = 120 + nextCorrect * 18 + Math.floor(elapsedRef.current / 1000) * 4;
    syncScore(scoreRef.current + bonus);
    setStatusText('정답! 다음 문제가 곧 떨어집니다.');

    transitionTimerRef.current = window.setTimeout(() => {
      setFaceState('idle');
      setMouthOpen(false);
      void advanceAfterCorrect();
    }, 620);
  }, [advanceAfterCorrect, clearLoopArtifacts, playSuccessSound, syncCorrectCount, syncFallers, syncScore, syncStatus]);

  const startLoop = useCallback(() => {
    clearLoopArtifacts();
    let prev = performance.now();

    const tick = () => {
      if (statusRef.current !== 'running') return;

      const now = performance.now();
      const delta = now - prev;
      prev = now;

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
        const horizontalGap = Math.abs(moved.x - playerCenterX);
        const inCatchHeight = moved.y >= playerTop - 16 && moved.y <= STAGE_HEIGHT - GROUND_HEIGHT + 8;
        const canCatch = horizontalGap <= nextPlayerMetrics.width * 0.34 + wordWidth * 0.34 && inCatchHeight;
        const nearMouth = horizontalGap <= nextPlayerMetrics.width * 0.48 && moved.y >= playerTop - 130;

        if (nearMouth) nextMouthOpen = true;

        if (canCatch) {
          sawCatch = true;
          if (moved.isAnswer) {
            handleCorrectCatch();
          } else {
            void finishGame('wrong');
          }
          break;
        }

        if (moved.y >= STAGE_HEIGHT - GROUND_HEIGHT - 6) {
          if (moved.isAnswer) {
            sawCatch = true;
            void finishGame('miss');
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
  }, [clearLoopArtifacts, finishGame, handleCorrectCatch, syncElapsed, syncFallers]);

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
    queuedQuestionRef.current = queuedQuestionRef.current;

    syncStatus('loading');
    syncScore(0);
    syncElapsed(0);
    syncCorrectCount(0);
    syncFallers([]);
    setFaceState('idle');
    setMouthOpen(false);
    setStatusText('문제를 준비하고 있어요…');
    syncPlayerX(stageWidthRef.current / 2);

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
  }, [beginRound, clearLoopArtifacts, fetchQuestion, syncCorrectCount, syncElapsed, syncFallers, syncPlayerX, syncScore, syncStatus]);

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
      <div style={pageInner}>
        <TopBar title="바이블 게임" backTo="/" hideAuthActions />

        <Card pad style={heroCard}>
          <div style={badgeMint}>BIBLE GAME</div>
          <div style={heroTitle}>정답 단어를 철수에게 먹여 주세요</div>
          <div style={heroDesc}>개역개정 성경 본문에서 랜덤으로 한 단어가 비워지고, 정답 1개와 오답 3개가 시간차를 두고 우박처럼 내려옵니다. 철수는 시간이 지날수록 커지고, 단어는 더 빠르게 더 가까운 곳에서 떨어집니다.</div>

          <div style={heroStatGrid}>
            <StatTile label="현재 티어" value={currentTier} hint="생존 시간 기준" tone="mint" />
            <StatTile label="현재 점수" value={`${score}`} hint={`${correctCount}개 정답`} tone="peach" />
            <StatTile label="최고 기록" value={bestFormatted} hint={`${myBest.tier} · ${myBest.score}점`} tone="mint" />
            <StatTile label="플레이어" value={me?.name ?? '나'} hint="랭킹 자동 반영" tone="peach" />
          </div>

          <div style={heroActionGrid}>
            <Button variant="primary" size="lg" onClick={() => void startGame()}>
              {gameStatus === 'idle' || gameStatus === 'gameover' ? '게임 시작' : '다시 시작'}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => nav('/bible-search')}>
              성경 검색으로 이동
            </Button>
          </div>
        </Card>

        <Card pad style={questionCard}>
          <div style={sectionEyebrow}>QUIZ</div>
          <div style={questionVerse}>{question?.textWithBlank ?? '시작 버튼을 누르면 랜덤 성경 구절이 표시됩니다.'}</div>
          <div style={questionMetaRow}>
            <span style={metaPillMint}>{question?.reference ?? '랜덤 구절 준비 중'}</span>
            <span style={metaPillNeutral}>정답 단어 1개 + 오답 3개</span>
          </div>
        </Card>

        <Card pad style={stageCard}>
          <div style={stageHeader}>
            <div>
              <div style={sectionEyebrow}>STAGE</div>
              <div style={sectionTitle}>철수의 말씀 우박 먹방</div>
            </div>
            <div style={stageChip}>{formattedElapsed}</div>
          </div>

          <div
            ref={stageRef}
            style={stageArea}
            onPointerDown={(e) => movePlayerToClientX(e.clientX)}
            onPointerMove={(e) => {
              if (e.pointerType === 'touch' || e.buttons > 0) movePlayerToClientX(e.clientX);
            }}
            onTouchStart={(e) => movePlayerToClientX(e.touches[0]?.clientX ?? 0)}
            onTouchMove={(e) => movePlayerToClientX(e.touches[0]?.clientX ?? 0)}
          >
            <div style={cloudA} />
            <div style={cloudB} />
            <div style={cloudC} />

            {fallers.map((item) => (
              <div
                key={item.id}
                style={{
                  ...fallerChip,
                  left: item.x - estimateWordWidth(item.word) / 2,
                  top: item.y,
                  minWidth: estimateWordWidth(item.word),
                  background: item.isAnswer ? 'rgba(255,255,255,0.96)' : 'rgba(236,244,255,0.92)',
                  borderColor: item.isAnswer ? 'rgba(114,215,199,0.35)' : 'rgba(188,210,239,0.65)'
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
                height: playerMetrics.height
              }}
            >
              <ChulsooAvatar faceState={faceState} mouthOpen={mouthOpen} />
              <div style={playerLabel}>철수</div>
            </div>

            {gameStatus === 'idle' ? (
              <div style={overlayCard}>
                <div style={overlayTitle}>손가락으로 좌우 이동</div>
                <div style={overlayDesc}>떨어지는 단어 중 정답만 입으로 받아 주세요. 오답을 먹거나 정답을 놓치면 종료됩니다.</div>
              </div>
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
                <div style={overlayStats}>생존 {formattedElapsed} · 정답 {correctCount}개 · 점수 {score}</div>
              </div>
            ) : null}
          </div>

          <div style={statusBar}>
            <div style={statusTextStyle}>{statusText}</div>
            <div style={statusMeta}>{difficultyLabel(difficulty.speedMultiplier)}</div>
          </div>
        </Card>

        <div style={infoGrid}>
          <Card pad style={sectionCard}>
            <div style={sectionEyebrow}>CURRENT RUN</div>
            <div style={sectionTitle}>지금 플레이</div>
            <div style={miniStatList}>
              <MiniStat label="생존 시간" value={formattedElapsed} />
              <MiniStat label="정답 수" value={`${correctCount}개`} />
              <MiniStat label="점수" value={`${score}점`} />
              <MiniStat label="난이도" value={currentTier} />
            </div>
          </Card>

          <Card pad style={sectionCard}>
            <div style={sectionEyebrow}>MY BEST</div>
            <div style={sectionTitle}>내 최고 기록</div>
            <div style={miniStatList}>
              <MiniStat label="최고 생존" value={bestFormatted} />
              <MiniStat label="최고 점수" value={`${myBest.score}점`} />
              <MiniStat label="최고 정답" value={`${myBest.correctCount}개`} />
              <MiniStat label="티어" value={myBest.tier} />
            </div>
            {submittingScore ? <div style={helperText}>랭킹 반영 중…</div> : null}
          </Card>
        </div>

        <Card pad style={sectionCard}>
          <div style={stageHeader}>
            <div>
              <div style={sectionEyebrow}>LEADERBOARD</div>
              <div style={sectionTitle}>오래 버티는 순 랭킹</div>
            </div>
            <div style={stageChip}>TOP 20</div>
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
              {leaderboard.map((item) => (
                <div key={item.userId} style={{ ...leaderboardRow, ...(item.userId === me?.id ? leaderboardRowMine : null) }}>
                  <div style={rankBadge}>{item.rank}</div>
                  <div style={leaderboardMain}>
                    <div style={leaderboardNameRow}>
                      <span style={leaderboardName}>{item.name}</span>
                      <span style={item.rank <= 3 ? metaPillPeach : metaPillMint}>{item.tier}</span>
                    </div>
                    <div style={leaderboardMeta}>생존 {formatDuration(item.survivalMs)} · 정답 {item.correctCount}개 · {item.score}점</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card pad style={sectionCard}>
          <div style={sectionEyebrow}>HOW TO PLAY</div>
          <div style={sectionTitle}>게임 규칙</div>
          <div style={ruleList}>
            <RuleLine title="문제" desc="개역개정 성경 구절에서 한 단어가 빈칸 처리됩니다." />
            <RuleLine title="낙하" desc="오답 3개와 정답 1개가 시간차를 두고 위에서 떨어집니다." />
            <RuleLine title="조작" desc="스테이지를 터치하거나 드래그해 철수를 좌우로 움직입니다." />
            <RuleLine title="실패" desc="오답을 먹거나 정답을 놓치면 철수가 찡그리며 게임이 종료됩니다." />
            <RuleLine title="성장" desc="시간이 지날수록 철수가 커지고, 단어는 더 빨라지고 더 가까운 곳에서 시작합니다." />
          </div>
        </Card>
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
    speedMultiplier: 1 + Math.min(2.35, elapsedMs / 22000 + correctCount * 0.07),
    playerScale: 1 + Math.min(1.15, elapsedMs / 32000 + correctCount * 0.045)
  };
}

function getPlayerMetrics(stageWidth: number, elapsedMs: number, correctCount: number) {
  const { playerScale } = getDifficulty(elapsedMs, correctCount);
  const width = Math.min(stageWidth * 0.42, 88 * playerScale + correctCount * 1.2);
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
  return Math.max(84, Math.min(146, word.length * 18 + 34));
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
  padding: '12px 14px 30px',
  background: 'transparent'
};

const pageInner: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  margin: '0 auto',
  display: 'grid',
  gap: 12
};

const heroCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)'
};

const badgeMint: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 10
};

const heroTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1.16,
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  marginTop: 8,
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const heroStatGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
};

const heroStatCard: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  border: '1px solid transparent',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)'
};

const heroStatLabel: CSSProperties = {
  color: '#6c7881',
  fontSize: 12,
  fontWeight: 700
};

const heroStatValue: CSSProperties = {
  marginTop: 8,
  color: '#24313a',
  fontSize: 22,
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
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
};

const questionCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.76)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 10px 24px rgba(77,90,110,0.08)'
};

const sectionEyebrow: CSSProperties = {
  color: '#83a39a',
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

const questionVerse: CSSProperties = {
  marginTop: 10,
  color: '#24313a',
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.55,
  letterSpacing: '-0.02em'
};

const questionMetaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12
};

const stageCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  overflow: 'hidden'
};

const stageHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 12
};

const stageChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const stageArea: CSSProperties = {
  position: 'relative',
  height: STAGE_HEIGHT,
  borderRadius: 22,
  overflow: 'hidden',
  background: 'linear-gradient(180deg, #e6f7ff 0%, #eefbff 44%, #fff3df 100%)',
  border: '1px solid rgba(188, 220, 240, 0.75)',
  touchAction: 'none',
  userSelect: 'none'
};

const cloudA: CSSProperties = {
  position: 'absolute',
  top: 26,
  left: 18,
  width: 92,
  height: 34,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.72)',
  boxShadow: '28px 8px 0 rgba(255,255,255,0.7), 54px -2px 0 rgba(255,255,255,0.74)'
};

const cloudB: CSSProperties = {
  position: 'absolute',
  top: 70,
  right: 62,
  width: 68,
  height: 24,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.68)',
  boxShadow: '20px 6px 0 rgba(255,255,255,0.65), 38px -2px 0 rgba(255,255,255,0.7)'
};

const cloudC: CSSProperties = {
  position: 'absolute',
  top: 120,
  left: 160,
  width: 74,
  height: 24,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.58)',
  boxShadow: '24px 7px 0 rgba(255,255,255,0.6), 42px 0 0 rgba(255,255,255,0.58)'
};

const fallerChip: CSSProperties = {
  position: 'absolute',
  minHeight: 42,
  padding: '0 14px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  fontWeight: 900,
  color: '#25405a',
  border: '1px solid rgba(255,255,255,0.85)',
  boxShadow: '0 12px 22px rgba(69,100,130,0.12)'
};

const groundBand: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: GROUND_HEIGHT,
  background: 'linear-gradient(180deg, #8ee4c8 0%, #58c49f 100%)',
  borderTop: '1px solid rgba(72,168,136,0.4)'
};

const playerWrap: CSSProperties = {
  position: 'absolute',
  bottom: 10,
  display: 'grid',
  placeItems: 'center'
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
  minHeight: 24,
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
  left: 16,
  right: 16,
  top: 18,
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.88)',
  border: '1px solid rgba(255,255,255,0.9)',
  boxShadow: '0 12px 24px rgba(77,90,110,0.08)'
};

const overlayCardDanger: CSSProperties = {
  ...overlayCard,
  background: 'rgba(255,245,245,0.92)',
  border: '1px solid rgba(235,170,170,0.58)'
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

const statusBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  marginTop: 12,
  flexWrap: 'wrap'
};

const statusTextStyle: CSSProperties = {
  color: '#67747d',
  fontSize: 13,
  lineHeight: 1.5,
  flex: 1
};

const statusMeta: CSSProperties = {
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const infoGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12
};

const sectionCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const miniStatList: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 12
};

const miniStatCard: CSSProperties = {
  padding: '12px 12px 10px',
  borderRadius: 16,
  background: 'rgba(248,250,251,0.78)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const miniStatLabel: CSSProperties = {
  color: '#6c7881',
  fontSize: 12,
  fontWeight: 700
};

const miniStatValue: CSSProperties = {
  marginTop: 8,
  color: '#24313a',
  fontSize: 19,
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
  gap: 10,
  marginTop: 10
};

const leaderboardRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 12px 10px',
  borderRadius: 18,
  background: 'rgba(248,250,251,0.78)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const leaderboardRowMine: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(114,215,199,0.14), rgba(255,255,255,0.74))',
  border: '1px solid rgba(114,215,199,0.26)'
};

const rankBadge: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(255,255,255,0.84)',
  border: '1px solid rgba(255,255,255,0.88)',
  color: '#4d6170',
  fontSize: 14,
  fontWeight: 900,
  flex: '0 0 36px'
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
  minHeight: 28,
  padding: '0 12px',
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
  gap: 12,
  marginTop: 12
};

const ruleLine: CSSProperties = {
  padding: '12px 12px 10px',
  borderRadius: 16,
  background: 'rgba(248,250,251,0.78)',
  border: '1px solid rgba(227,233,237,0.92)'
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
