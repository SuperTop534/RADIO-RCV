import { useSyncExternalStore } from 'react';
import { radio } from '../services/radioInstance.ts';
import { youtube } from '../services/youtube.ts';

export const useRadio = () => useSyncExternalStore(radio.subscribe, radio.getSnapshot, radio.getSnapshot);
export const useYouTube = () => useSyncExternalStore(youtube.subscribe, youtube.getSnapshot, youtube.getSnapshot);
