/**
 * Namespaced diagnostic logging, usable on both server and client.
 *
 * Every meaningful step of every feature logs through here with a bracketed
 * namespace ([auth login], [api process], [upload extract], ...) and the
 * actual values involved, so a silent failure can be located from the
 * console alone.
 */

type Details = Record<string, unknown>;

export interface Logger {
  info(message: string, details?: Details): void;
  warn(message: string, details?: Details): void;
  error(message: string, details?: Details): void;
}

export function log(namespace: string): Logger {
  const prefix = `[${namespace}]`;
  return {
    info(message, details) {
      if (details !== undefined) console.info(prefix, message, details);
      else console.info(prefix, message);
    },
    warn(message, details) {
      if (details !== undefined) console.warn(prefix, message, details);
      else console.warn(prefix, message);
    },
    error(message, details) {
      if (details !== undefined) console.error(prefix, message, details);
      else console.error(prefix, message);
    },
  };
}
