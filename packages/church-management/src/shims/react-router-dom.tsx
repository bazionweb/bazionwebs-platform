import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

export interface Location {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
  key: string;
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export type To = string | { pathname?: string; search?: string; hash?: string };

interface RouterContextValue {
  location: Location;
  basename: string;
  navigate: (to: To | number, options?: NavigateOptions) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);
const ParamsContext = createContext<Record<string, string | undefined>>({});
const OutletContext = createContext<React.ReactNode>(null);

function normalizeBasename(basename?: string): string {
  if (!basename || basename === "/") return "";
  const cleaned = basename.startsWith("/") ? basename : `/${basename}`;
  return cleaned.endsWith("/") ? cleaned.slice(0, -1) : cleaned;
}

function stripBasename(pathname: string, basename: string): string {
  if (!basename) return pathname || "/";
  if (pathname === basename) return "/";
  if (pathname.startsWith(`${basename}/`)) {
    return pathname.slice(basename.length) || "/";
  }
  return pathname || "/";
}

function parseTo(to: To): { pathname: string; search: string; hash: string } {
  const raw =
    typeof to === "string"
      ? to
      : `${to.pathname ?? ""}${to.search ?? ""}${to.hash ?? ""}`;
  const hashIdx = raw.indexOf("#");
  const hash = hashIdx >= 0 ? raw.slice(hashIdx) : "";
  const beforeHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  const searchIdx = beforeHash.indexOf("?");
  const search = searchIdx >= 0 ? beforeHash.slice(searchIdx) : "";
  const pathname = (searchIdx >= 0 ? beforeHash.slice(0, searchIdx) : beforeHash) || "/";
  return { pathname, search, hash };
}

function resolveHref(to: To, basename: string, currentPathname: string): { internal: string; browser: string; external?: string } {
  if (typeof to === "string" && /^(https?:\/\/|mailto:|tel:)/i.test(to)) {
    return { internal: to, browser: to, external: to };
  }
  const { pathname, search, hash } = parseTo(to);
  const resolvedPath = pathname.startsWith("/")
    ? pathname
    : `${currentPathname.replace(/\/[^/]*$/, "")}/${pathname}`.replace(/\/+/g, "/");
  const internal = `${resolvedPath}${search}${hash}`;
  const browser = basename
    ? `${basename}${resolvedPath === "/" ? "" : resolvedPath}${search}${hash}` || basename
    : internal;
  return { internal, browser };
}

export function BrowserRouter({
  children,
  basename = "",
}: {
  children?: React.ReactNode;
  basename?: string;
}) {
  const normalized = useMemo(() => normalizeBasename(basename), [basename]);

  const readBrowserLocation = useCallback((): Location => {
    if (typeof window === "undefined") {
      return { pathname: "/", search: "", hash: "", state: null, key: "ssr" };
    }
    return {
      pathname: stripBasename(window.location.pathname, normalized),
      search: window.location.search,
      hash: window.location.hash,
      state: window.history.state,
      key: "browser",
    };
  }, [normalized]);

  const [location, setLocation] = useState<Location>(readBrowserLocation);

  useEffect(() => {
    setLocation(readBrowserLocation());
    const onPopState = () => setLocation(readBrowserLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [readBrowserLocation]);

  const navigate = useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") window.history.go(to);
        return;
      }
      const { internal, browser, external } = resolveHref(to, normalized, location.pathname);
      if (external && typeof window !== "undefined") {
        window.location.assign(external);
        return;
      }
      if (typeof window !== "undefined") {
        if (options?.replace) {
          window.history.replaceState(options?.state ?? null, "", browser);
        } else {
          window.history.pushState(options?.state ?? null, "", browser);
        }
      }
      const parsed = parseTo(internal);
      setLocation({
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        state: options?.state ?? null,
        key: String(Date.now()),
      });
    },
    [normalized, location.pathname]
  );

  const value = useMemo(
    () => ({ location, basename: normalized, navigate }),
    [location, normalized, navigate]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function HashRouter({
  children,
  basename = "",
}: {
  children?: React.ReactNode;
  basename?: string;
}) {
  const normalized = useMemo(() => normalizeBasename(basename), [basename]);

  const readHashLocation = useCallback((): Location => {
    if (typeof window === "undefined") {
      return { pathname: "/", search: "", hash: "", state: null, key: "ssr" };
    }
    const rawHash = window.location.hash.replace(/^#/, "") || "/";
    const parsed = parseTo(rawHash);
    return {
      pathname: stripBasename(parsed.pathname, normalized),
      search: parsed.search,
      hash: parsed.hash,
      state: window.history.state,
      key: "hash",
    };
  }, [normalized]);

  const [location, setLocation] = useState<Location>(readHashLocation);

  useEffect(() => {
    setLocation(readHashLocation());
    const onHashChange = () => setLocation(readHashLocation());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [readHashLocation]);

  const navigate = useCallback(
    (to: To | number, _options?: NavigateOptions) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") window.history.go(to);
        return;
      }
      const { internal } = resolveHref(to, normalized, location.pathname);
      if (typeof window !== "undefined") {
        window.location.hash = `#${internal}`;
      }
      const parsed = parseTo(internal);
      setLocation({
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        state: null,
        key: String(Date.now()),
      });
    },
    [normalized, location.pathname]
  );

  const value = useMemo(
    () => ({ location, basename: normalized, navigate }),
    [location, normalized, navigate]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function MemoryRouter({
  children,
  initialEntries = ["/"],
  basename = "",
}: {
  children?: React.ReactNode;
  initialEntries?: string[];
  basename?: string;
}) {
  const normalized = useMemo(() => normalizeBasename(basename), [basename]);
  const [entries, setEntries] = useState<Location[]>(() =>
    initialEntries.map((entry, idx) => {
      const parsed = parseTo(entry);
      return {
        pathname: stripBasename(parsed.pathname, normalized),
        search: parsed.search,
        hash: parsed.hash,
        state: null,
        key: `mem-${idx}`,
      };
    })
  );
  const [index, setIndex] = useState(Math.max(0, initialEntries.length - 1));

  const current = entries[index] ?? { pathname: "/", search: "", hash: "", state: null, key: "mem-0" };

  const navigate = useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        setIndex((prev) => Math.max(0, Math.min(entries.length - 1, prev + to)));
        return;
      }
      const { internal } = resolveHref(to, normalized, current.pathname);
      const parsed = parseTo(internal);
      const nextLoc: Location = {
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        state: options?.state ?? null,
        key: `mem-${Date.now()}`,
      };
      setEntries((prev) => {
        if (options?.replace) {
          const copy = [...prev];
          copy[index] = nextLoc;
          return copy;
        }
        return [...prev.slice(0, index + 1), nextLoc];
      });
      if (!options?.replace) setIndex((i) => i + 1);
    },
    [normalized, current.pathname, entries.length, index]
  );

  const value = useMemo(
    () => ({ location: current, basename: normalized, navigate }),
    [current, normalized, navigate]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

interface CompiledRoute {
  path?: string;
  index?: boolean;
  element?: React.ReactNode;
  children?: CompiledRoute[];
}

function collectRoutes(children: React.ReactNode): CompiledRoute[] {
  const list: CompiledRoute[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      list.push(...collectRoutes((child.props as { children?: React.ReactNode }).children));
      return;
    }
    const props = child.props as {
      path?: string;
      index?: boolean;
      element?: React.ReactNode;
      children?: React.ReactNode;
    };
    list.push({
      path: props.path,
      index: props.index,
      element: props.element,
      children: props.children ? collectRoutes(props.children) : undefined,
    });
  });
  return list;
}

function normalizeRoutePath(p: string): string {
  if (!p) return "/";
  const prefixed = p.startsWith("/") ? p : `/${p}`;
  return prefixed.length > 1 && prefixed.endsWith("/") ? prefixed.slice(0, -1) : prefixed;
}

function matchSinglePattern(
  pattern: string,
  pathname: string
): { matched: boolean; params: Record<string, string>; remainingPath: string; score: number } | null {
  if (pattern === "*") {
    return { matched: true, params: { "*": pathname.replace(/^\//, "") }, remainingPath: "/", score: 1 };
  }
  const cleanPattern = normalizeRoutePath(pattern);
  const cleanPath = normalizeRoutePath(pathname);

  const patSegs = cleanPattern === "/" ? [] : cleanPattern.slice(1).split("/");
  const pathSegs = cleanPath === "/" ? [] : cleanPath.slice(1).split("/");
  const hasWildcard = patSegs[patSegs.length - 1] === "*";
  const effectivePat = hasWildcard ? patSegs.slice(0, -1) : patSegs;

  if (!hasWildcard && effectivePat.length !== pathSegs.length) {
    return null;
  }
  if (hasWildcard && pathSegs.length < effectivePat.length) {
    return null;
  }

  const params: Record<string, string> = {};
  let score = 0;
  for (let i = 0; i < effectivePat.length; i++) {
    const seg = effectivePat[i];
    const actual = pathSegs[i];
    if (seg.startsWith(":")) {
      params[seg.slice(1)] = decodeURIComponent(actual);
      score += 20;
    } else if (seg === actual) {
      score += 100;
    } else {
      return null;
    }
  }
  if (hasWildcard) {
    params["*"] = pathSegs.slice(effectivePat.length).join("/");
    score += 5;
  } else {
    score += 50;
  }
  const remaining = "/" + pathSegs.slice(effectivePat.length).join("/");
  return { matched: true, params, remainingPath: remaining, score };
}

function findMatchingBranch(
  routes: CompiledRoute[],
  pathname: string,
  parentPath = ""
): { branch: CompiledRoute[]; params: Record<string, string>; score: number } | null {
  let best: { branch: CompiledRoute[]; params: Record<string, string>; score: number } | null = null;

  for (const route of routes) {
    const combinedPattern = route.index
      ? parentPath || "/"
      : route.path
        ? route.path.startsWith("/")
          ? route.path
          : `${parentPath.replace(/\/$/, "")}/${route.path}`
        : parentPath || "/";

    if (route.children && route.children.length > 0) {
      const childMatch = findMatchingBranch(route.children, pathname, combinedPattern);
      if (childMatch) {
        const candidate = {
          branch: [route, ...childMatch.branch],
          params: childMatch.params,
          score: childMatch.score,
        };
        if (!best || candidate.score > best.score) best = candidate;
      }
      const prefixPattern = combinedPattern === "/" ? "/*" : `${combinedPattern.replace(/\/$/, "")}/*`;
      const prefixRes = matchSinglePattern(prefixPattern, pathname);
      if (prefixRes && !childMatch) {
        const indexChild = route.children.find((c) => c.index);
        if (indexChild && normalizeRoutePath(pathname) === normalizeRoutePath(combinedPattern)) {
          const candidate = {
            branch: [route, indexChild],
            params: prefixRes.params,
            score: prefixRes.score + 50,
          };
          if (!best || candidate.score > best.score) best = candidate;
        }
      }
    } else {
      const res = matchSinglePattern(combinedPattern, pathname);
      if (res) {
        const candidate = { branch: [route], params: res.params, score: res.score };
        if (!best || candidate.score > best.score) best = candidate;
      }
    }
  }

  return best;
}

export function Route(_props: {
  path?: string;
  index?: boolean;
  element?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return null;
}

export function Outlet() {
  return <>{useContext(OutletContext)}</>;
}

export function Routes({ children }: { children?: React.ReactNode }) {
  const ctx = useContext(RouterContext);
  const pathname = ctx?.location.pathname ?? "/";
  const compiled = useMemo(() => collectRoutes(children), [children]);
  const match = useMemo(() => findMatchingBranch(compiled, pathname), [compiled, pathname]);

  if (!match) return null;

  let node: React.ReactNode = null;
  for (let i = match.branch.length - 1; i >= 0; i--) {
    const el = match.branch[i]?.element ?? <Outlet />;
    node = <OutletContext.Provider value={node}>{el}</OutletContext.Provider>;
  }

  return <ParamsContext.Provider value={match.params}>{node}</ParamsContext.Provider>;
}

export function Navigate({ to, replace }: { to: To; replace?: boolean; state?: unknown }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
}

export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: To;
  replace?: boolean;
  state?: unknown;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, replace, state, onClick, target, ...rest }, ref) => {
    const ctx = useContext(RouterContext);
    const basename = ctx?.basename ?? "";
    const currentPath = ctx?.location.pathname ?? "/";
    const { browser, external } = resolveHref(to, basename, currentPath);

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (
        e.defaultPrevented ||
        external ||
        target === "_blank" ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      ) {
        return;
      }
      e.preventDefault();
      ctx?.navigate(to, { replace, state });
    };

    return <a ref={ref} href={browser} target={target} onClick={handleClick} {...rest} />;
  }
);
Link.displayName = "Link";

export interface NavLinkProps extends Omit<LinkProps, "className"> {
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string);
  end?: boolean;
}

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, className, end = false, ...rest }, ref) => {
    const location = useLocation();
    const targetPath = parseTo(to).pathname;
    const isActive = end
      ? location.pathname === targetPath
      : targetPath === "/"
        ? location.pathname === "/"
        : location.pathname === targetPath || location.pathname.startsWith(`${targetPath}/`);
    const resolvedClassName =
      typeof className === "function" ? className({ isActive, isPending: false }) : className;
    return <Link ref={ref} to={to} className={resolvedClassName} {...rest} />;
  }
);
NavLink.displayName = "NavLink";

export function useNavigate() {
  const ctx = useContext(RouterContext);
  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      ctx?.navigate(to, options);
    },
    [ctx]
  );
}

export function useLocation(): Location {
  const ctx = useContext(RouterContext);
  return (
    ctx?.location ?? { pathname: "/", search: "", hash: "", state: null, key: "default" }
  );
}

export function useSearchParams(): [
  URLSearchParams,
  (nextInit: URLSearchParams | Record<string, string>, options?: NavigateOptions) => void,
] {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const setSearchParams = useCallback(
    (nextInit: URLSearchParams | Record<string, string>, options?: NavigateOptions) => {
      const sp =
        nextInit instanceof URLSearchParams ? nextInit : new URLSearchParams(nextInit);
      const q = sp.toString();
      navigate({ pathname: location.pathname, search: q ? `?${q}` : "", hash: location.hash }, options);
    },
    [location.pathname, location.hash, navigate]
  );

  return [params, setSearchParams];
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  return useContext(ParamsContext) as T;
}

