"use client";

import { createContext, useContext } from "react";

/** Launch info provided by the /spacepilot page; absent in the member preview tab (which stays "beta"). */
export type Launch = { at: number; launched: boolean };
export const LaunchContext = createContext<Launch | null>(null);
export const useLaunch = () => useContext(LaunchContext);
