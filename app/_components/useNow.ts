"use client";
// "What time is it?" for the "3 weeks ago" labels.
//
// The first render uses the SERVER's time, so the page the phone keeps for
// offline reading shows ages as of when it was saved, and so the browser's
// first render matches the server's HTML exactly. Right after loading it
// switches to the phone's own clock and refreshes every minute.
import { useEffect, useState } from "react";

export function useNow(serverNow: string): number {
  const [now, setNow] = useState(() => Date.parse(serverNow));
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
