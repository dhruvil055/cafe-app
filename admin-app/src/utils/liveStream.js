const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const subscribeToLiveStream = (path, { onEvent }) => {
  const controller = new AbortController();
  const baseUrl = String(import.meta.env.VITE_API_URL || (import.meta.env.PROD
    ? 'https://cafe-app-n8mn.onrender.com/api'
    : '/api')).replace(/\/$/, '');
  const url = new URL(`${baseUrl}${path}`, window.location.origin);

  const run = async () => {
    while (!controller.signal.aborted) {
      try {
        const open = () => {
          const token = getAccessToken();
          return fetch(url, {
            headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            credentials: 'include',
            signal: controller.signal,
          });
        };
        let response = await open();
        if (response.status === 401) {
          const { data } = await api.post('/auth/refresh');
          setAccessToken(data.token);
          response = await open();
        }
        if (!response.ok || !response.body) throw new Error(`Live updates returned ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            let type = 'message';
            let data = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) type = line.slice(6).trim();
              if (line.startsWith('data:')) data += line.slice(5).trim();
            }
            if (type !== 'message' || data) {
              try { onEvent(type, data ? JSON.parse(data) : {}); } catch { /* Ignore malformed event payloads. */ }
            }
          }
        }
      } catch (error) {
        if (controller.signal.aborted) break;
      }
      if (!controller.signal.aborted) await wait(2500);
    }
  };

  run();
  return () => controller.abort();
};
import { getAccessToken, setAccessToken } from '../services/accessToken';
import api from '../services/api';

