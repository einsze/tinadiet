import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_THEME_SLUG,
  resolveThemeSlug,
  THEME_META,
  type ThemeMeta,
  type ThemeSlug,
} from '../themes/catalog.js';
import { applyTheme } from '../themes/palettes.js';
import { useSession } from './session.js';

type ThemeContextValue = {
  activeSlug: ThemeSlug;
  activeMeta: ThemeMeta;
  setActiveSlug: (slug: ThemeSlug) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { status } = useSession();
  const userSlug =
    status.kind === 'authenticated' ? status.user.active_theme_slug : null;
  const [override, setOverride] = useState<ThemeSlug | null>(null);

  // Reset local override when user logs out or their server-stored slug changes
  // (e.g. after activate or purchase).
  useEffect(() => {
    setOverride(null);
  }, [userSlug]);

  const activeSlug: ThemeSlug = useMemo(() => {
    if (override !== null) return override;
    return resolveThemeSlug(userSlug);
  }, [override, userSlug]);

  useEffect(() => {
    applyTheme(activeSlug);
  }, [activeSlug]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      activeSlug,
      activeMeta: THEME_META[activeSlug],
      setActiveSlug: (slug: ThemeSlug) => setOverride(slug),
    }),
    [activeSlug]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    // Outside provider (e.g. legal page boot before SessionProvider mounts) →
    // return safe default and a no-op setter.
    return {
      activeSlug: DEFAULT_THEME_SLUG,
      activeMeta: THEME_META[DEFAULT_THEME_SLUG],
      setActiveSlug: () => {},
    };
  }
  return ctx;
};
