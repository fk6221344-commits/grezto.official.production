type BackHandler = {
  id: string;
  handler: () => boolean;
  priority: number;
};

const handlers: BackHandler[] = [];

export function registerBackHandler(id: string, handler: () => boolean, priority: number = 10) {
  // Remove existing if any to avoid duplicates
  const index = handlers.findIndex(h => h.id === id);
  if (index !== -1) {
    handlers[index] = { id, handler, priority };
  } else {
    handlers.push({ id, handler, priority });
  }
  // Keep sorted by priority descending (highest priority first)
  handlers.sort((a, b) => b.priority - a.priority);
  console.log(`[BackRegistry] Registered handler "${id}" (priority: ${priority}). Total: ${handlers.length}`);
}

export function unregisterBackHandler(id: string) {
  const index = handlers.findIndex(h => h.id === id);
  if (index !== -1) {
    handlers.splice(index, 1);
    console.log(`[BackRegistry] Unregistered handler "${id}". Total: ${handlers.length}`);
  }
}

export function runBackHandlers(): boolean {
  console.log(`[BackRegistry] Running back handlers. Current count: ${handlers.length}`);
  for (const item of handlers) {
    try {
      const handled = item.handler();
      if (handled) {
        console.log(`[BackRegistry] Handler "${item.id}" (priority: ${item.priority}) CONSUMED back button.`);
        return true;
      }
    } catch (e) {
      console.error(`[BackRegistry] Error in back handler "${item.id}":`, e);
    }
  }
  return false;
}
