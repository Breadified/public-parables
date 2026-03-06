/**
 * Navigation Store - Navigation history for Smart Grid Navigator
 * Handles: recent locations tracking
 */

import { observable } from "@legendapp/state";
import type { NavigationLocation } from "../types/stores";

export const navigationStore$ = observable({
  // Navigation history for Smart Grid Navigator
  recentLocations: [] as NavigationLocation[],

  // Method to add recent location
  addRecentLocation: (chapterId: number, bookName: string, chapterNumber: number) => {
    const locations = navigationStore$.recentLocations.get();
    const newLocation: NavigationLocation = {
      chapterId,
      bookName,
      chapterNumber,
      timestamp: Date.now(),
    };

    // Remove duplicate if exists
    const filtered = locations.filter(
      (loc: NavigationLocation) => loc.chapterId !== chapterId
    );

    // Add new location at the beginning and limit to 10
    const updated = [newLocation, ...filtered].slice(0, 10);
    navigationStore$.recentLocations.set(updated);
  },
});
