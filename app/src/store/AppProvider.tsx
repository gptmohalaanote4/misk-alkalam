import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { ContentBundle, ContentItem, Scholar, Schedule, Source } from '../data/types';
import { SEED_CONTENT } from '../data/seed';
import { availablePools, indexContent, loadCachedContent, syncContent } from '../lib/content';
import {
  EMPTY_STATE,
  currentItemId,
  isOrderedKind,
  nextDelivery,
  nextKindAfter,
  reconcile,
  seedFirstItem,
  type DeliveryState,
} from '../lib/delivery';
import { takeNext, ensureQueue } from '../lib/queue';
import { DEFAULT_SCHEDULE } from '../lib/schedule';
import {
  cancelAll,
  getPermissionState,
  requestPermission,
  syncScheduledNotifications,
  type PermissionState,
} from '../lib/notifications';
import { getItem, setItem, KEYS } from '../lib/storage';

interface AppContextValue {
  ready: boolean;
  content: ContentBundle;
  itemsById: Map<string, ContentItem>;
  scholarsById: Map<string, Scholar>;
  sourcesById: Map<string, Source>;
  schedule: Schedule;
  delivery: DeliveryState;
  favorites: string[];
  followed: string[];
  permission: PermissionState;
  syncing: boolean;
  /** العنصر المعروض اليوم (مقولة أو حديث). */
  todayItem: ContentItem | null;
  nextAt: Date | null;
  updateSchedule: (next: Schedule) => Promise<void>;
  toggleFavorite: (itemId: string) => Promise<void>;
  toggleFollow: (scholarId: string) => Promise<void>;
  drawAnother: () => Promise<void>;
  enableNotifications: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [content, setContent] = useState<ContentBundle>(SEED_CONTENT);
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE);
  const [delivery, setDelivery] = useState<DeliveryState>(EMPTY_STATE);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  // نُبقي أحدث القيم في مراجع حتى لا تعتمد دوال التوفيق على إغلاقات قديمة.
  const latest = useRef({ content, schedule, delivery, followed, permission });
  latest.current = { content, schedule, delivery, followed, permission };

  const { itemsById, scholarsById, sourcesById } = useMemo(() => indexContent(content), [content]);

  /**
   * القلب النابض: يوفّق بين الجدولة والمحتوى، يحدّث السجل،
   * ثم يعيد جدولة الإشعارات المحلية عند الحاجة.
   */
  const runReconcile = useCallback(
    async (overrides?: { content?: ContentBundle; schedule?: Schedule; followed?: string[] }) => {
      const base = latest.current;
      const nextContent = overrides?.content ?? base.content;
      const nextSchedule = overrides?.schedule ?? base.schedule;
      const nextFollowed = overrides?.followed ?? base.followed;

      const pools = availablePools(nextContent, nextFollowed);

      let state = seedFirstItem(base.delivery, pools, new Date());
      const result = reconcile(state, nextSchedule, pools, new Date());
      state = result.state;

      const granted = base.permission === 'granted';
      if (granted && nextSchedule.enabled) {
        const { itemsById: iIndex, scholarsById: sIndex } = indexContent(nextContent);
        const scheduledPlan = await syncScheduledNotifications({
          plan: state.plan,
          itemsById: iIndex,
          scholarsById: sIndex,
        });
        state = { ...state, plan: scheduledPlan };
      } else if (!nextSchedule.enabled) {
        await cancelAll();
      }

      setDelivery(state);
      latest.current = { ...latest.current, delivery: state };
      await setItem(KEYS.plan, state.plan);
      await setItem(KEYS.history, state.history);
      await setItem(KEYS.queue, state.queues);
    },
    [],
  );

  // الإقلاع: تحميل كل شيء من التخزين المحلي، ثم مزامنة الخادم في الخلفية.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [cached, storedSchedule, plan, history, queues, favs, follows, perm] = await Promise.all([
        loadCachedContent(),
        getItem<Schedule>(KEYS.schedule),
        getItem<DeliveryState['plan']>(KEYS.plan),
        getItem<DeliveryState['history']>(KEYS.history),
        getItem<DeliveryState['queues']>(KEYS.queue),
        getItem<string[]>(KEYS.favorites),
        getItem<string[]>(KEYS.followedScholars),
        getPermissionState(),
      ]);
      if (cancelled) return;

      const loadedSchedule = storedSchedule ?? DEFAULT_SCHEDULE;
      const loadedDelivery: DeliveryState = {
        plan: plan ?? [],
        history: history ?? [],
        queues: queues ?? EMPTY_STATE.queues,
      };

      setContent(cached);
      setSchedule(loadedSchedule);
      setDelivery(loadedDelivery);
      setFavorites(favs ?? []);
      setFollowed(follows ?? []);
      setPermission(perm);
      latest.current = {
        content: cached,
        schedule: loadedSchedule,
        delivery: loadedDelivery,
        followed: follows ?? [],
        permission: perm,
      };

      await runReconcile();
      if (cancelled) return;
      setReady(true);

      // مزامنة المحتوى من الخادم (إن كان مُفعّلاً) دون تعطيل الواجهة.
      setSyncing(true);
      const remote = await syncContent();
      if (!cancelled && remote) {
        setContent(remote);
        latest.current = { ...latest.current, content: remote };
        await runReconcile({ content: remote });
      }
      if (!cancelled) setSyncing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [runReconcile]);

  // عند عودة التطبيق للواجهة: نرقّي ما مضى من مواعيد ونجدّد الجدولة.
  useEffect(() => {
    const onChange = (status: AppStateStatus) => {
      if (status === 'active') {
        void getPermissionState().then((p) => {
          setPermission(p);
          latest.current = { ...latest.current, permission: p };
          return runReconcile();
        });
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [runReconcile]);

  const updateSchedule = useCallback(
    async (next: Schedule) => {
      setSchedule(next);
      latest.current = { ...latest.current, schedule: next };
      await setItem(KEYS.schedule, next);
      await runReconcile({ schedule: next });
    },
    [runReconcile],
  );

  const toggleFavorite = useCallback(async (itemId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [itemId, ...prev];
      void setItem(KEYS.favorites, next);
      return next;
    });
  }, []);

  const toggleFollow = useCallback(
    async (scholarId: string) => {
      const current = latest.current.followed;
      const next = current.includes(scholarId)
        ? current.filter((id) => id !== scholarId)
        : [...current, scholarId];
      setFollowed(next);
      latest.current = { ...latest.current, followed: next };
      await setItem(KEYS.followedScholars, next);
      await runReconcile({ followed: next });
    },
    [runReconcile],
  );

  /** يسحب عنصراً جديداً فوراً دون انتظار الموعد، ماضياً في دورة التناوب. */
  const drawAnother = useCallback(async () => {
    const base = latest.current;
    const pools = availablePools(base.content, base.followed);
    const last = base.delivery.history[base.delivery.history.length - 1] ?? null;

    // التناوب يحكمه موضعٌ واحد في محرّك التسليم، فلا يختلف هنا عن الجدولة.
    const kind = nextKindAfter(last?.kind ?? null, pools);
    if (!kind) return;

    const queue = ensureQueue(
      base.delivery.queues[kind],
      pools[kind],
      last?.kind === kind ? last.itemId : null,
      isOrderedKind(kind),
    );
    const { ids: drawn, queue: nextQueue } = takeNext(queue, 1);
    if (drawn.length === 0) return;

    const state: DeliveryState = {
      ...base.delivery,
      queues: { ...base.delivery.queues, [kind]: nextQueue },
      history: [...base.delivery.history, { at: new Date().toISOString(), itemId: drawn[0], kind }],
    };
    setDelivery(state);
    latest.current = { ...latest.current, delivery: state };
    await setItem(KEYS.history, state.history);
    await setItem(KEYS.queue, state.queues);
  }, []);

  const enableNotifications = useCallback(async () => {
    const granted = await requestPermission();
    const state: PermissionState = granted ? 'granted' : 'denied';
    setPermission(state);
    latest.current = { ...latest.current, permission: state };
    if (granted) await runReconcile();
    return granted;
  }, [runReconcile]);

  const refresh = useCallback(async () => {
    setSyncing(true);
    const remote = await syncContent();
    if (remote) {
      setContent(remote);
      latest.current = { ...latest.current, content: remote };
      await runReconcile({ content: remote });
    } else {
      await runReconcile();
    }
    setSyncing(false);
  }, [runReconcile]);

  const todayItem = useMemo(() => {
    const id = currentItemId(delivery);
    return id ? itemsById.get(id) ?? null : null;
  }, [delivery, itemsById]);

  const nextAt = useMemo(() => {
    const entry = nextDelivery(delivery);
    if (!entry) return null;
    const ts = Date.parse(entry.at);
    return Number.isNaN(ts) ? null : new Date(ts);
  }, [delivery]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      content,
      itemsById,
      scholarsById,
      sourcesById,
      schedule,
      delivery,
      favorites,
      followed,
      permission,
      syncing,
      todayItem,
      nextAt,
      updateSchedule,
      toggleFavorite,
      toggleFollow,
      drawAnother,
      enableNotifications,
      refresh,
    }),
    [
      ready,
      content,
      itemsById,
      scholarsById,
      sourcesById,
      schedule,
      delivery,
      favorites,
      followed,
      permission,
      syncing,
      todayItem,
      nextAt,
      updateSchedule,
      toggleFavorite,
      toggleFollow,
      drawAnother,
      enableNotifications,
      refresh,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
