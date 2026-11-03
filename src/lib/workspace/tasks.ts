type Task = {
  epoch: number;
  controller: AbortController;
};

const tasks = new Map<string, Task>();
const epochs = new Map<string, number>();

export type WorkspaceTask = {
  epoch: number;
  controller: AbortController;
};

/**
 * Starts a new task for a workspace and aborts the previous one.
 * The epoch lets old response callbacks bail out even if they were started by a
 * component that has since unmounted.
 */
export function beginWorkspaceTask(key: string): WorkspaceTask {
  const previous = tasks.get(key);
  previous?.controller.abort();

  const epoch = (epochs.get(key) ?? 0) + 1;
  const controller = new AbortController();
  epochs.set(key, epoch);
  tasks.set(key, { epoch, controller });
  return { epoch, controller };
}

export function isWorkspaceTaskCurrent(key: string, epoch: number): boolean {
  return epochs.get(key) === epoch;
}

export function finishWorkspaceTask(key: string, epoch: number): void {
  if (!isWorkspaceTaskCurrent(key, epoch)) return;
  const task = tasks.get(key);
  if (task?.epoch === epoch) tasks.delete(key);
}

/** Cancels the active task and makes any in-flight response stale. */
export function cancelWorkspaceTask(key: string): void {
  const epoch = (epochs.get(key) ?? 0) + 1;
  epochs.set(key, epoch);
  const task = tasks.get(key);
  task?.controller.abort();
  tasks.delete(key);
}