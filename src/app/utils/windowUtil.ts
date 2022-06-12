import { CLOSE_WINDOW_DELAY } from './constants';

export const closeWindow = () => {
  setTimeout(() => {
    window.close();
  }, CLOSE_WINDOW_DELAY);
};
