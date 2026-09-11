import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/** Thin horizontal line that sweeps left to right on every route change. */
export function RouteProgressBar() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [cycle, setCycle] = useState(0);
  const firstRender = useRef(true);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setVisible(true);
    setCycle((c) => c + 1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), 700);
    return () => window.clearTimeout(timer.current);
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div className="route-progress-wrap" aria-hidden="true">
      <div key={cycle} className="route-progress-bar" />
    </div>
  );
}
