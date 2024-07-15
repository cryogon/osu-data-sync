import crypto from "node:crypto";

// TODO: Can add some cooldown to tasks which have failed or even remove them if they fail too much
interface Task<T extends any[], R> {
  id: string;
  name: string;
  execute: (...args: T) => Promise<any> | any;
  completed: boolean;
  executeCount: number;
  response: R;
  args: T;
}

type TaskTypeRegistry = {
  [key: string]: { args: any[]; returnType: any };
};

const taskTypeRegistry: TaskTypeRegistry = {};

let mainLoop: Timer;
const tasks: Task<any[], any>[] = [];
const completedTasks: Task<any[], any>[] = [];

export function loadTask<T extends any[], R>(
  cb: (...args: T) => Promise<R> | R,
  ...args: T
) {
  const taskId = crypto.randomUUID();
  tasks.push({
    name: cb.name,
    execute: cb,
    executeCount: 0,
    completed: false,
    id: taskId,
    response: null,
    args: args,
  });

  taskTypeRegistry[taskId] = { args, returnType: null as unknown as R };
  if (!mainLoop) {
    mainLoop = setInterval(taskQueue, 1000);
  }

  return taskId;
}

// TODO: Use Generics on this method to get exact return type of task with taskId
export function getCompletedTask<T extends keyof typeof taskTypeRegistry>(
  taskId: T,
  timeout?: number
): Promise<
  Task<
    (typeof taskTypeRegistry)[T]["args"],
    (typeof taskTypeRegistry)[T]["returnType"]
  >
> {
  return new Promise((resolve, reject) => {
    let int: Timer;
    let timer: Timer;

    if (timeout) {
      timer = setTimeout(() => {
        clearInterval(int);
        reject("timeout: couldn't get the task as its not completed yet.");
      }, timeout);
    }

    int = setInterval(() => {
      const task = getTask<
        (typeof taskTypeRegistry)[T]["args"],
        (typeof taskTypeRegistry)[T]["returnType"]
      >(taskId as string, "completed_only");
      if (task) {
        clearTimeout(timer);
        clearInterval(int);
        resolve(task);
      }
    }, 1000);
  });
}

export function getTask<A extends any[], R>(
  taskId: string,
  taskType: "completed_only" | "running_only" | "all" = "all"
): Task<A, R> | null {
  const t =
    taskType === "completed_only"
      ? completedTasks
      : taskType === "running_only"
      ? tasks
      : [...tasks, ...completedTasks];
  for (const task of t) {
    if (task.id === taskId) {
      return task as Task<A, R>;
    }
  }
  return null;
}

// executes tasks
async function taskQueue() {
  const task = tasks.shift();
  if (!task) return;
  task.executeCount++;
  try {
    console.log("here");
    // task.response = await task.execute(...task.args);
    task.response = await executeTask(task.execute, ...task.args);
    task.completed = true;
    completedTasks.push(task);
  } catch (error: any) {
    console.error(`Task ${task.id} failed: ${error.message}`);
    tasks.push(task); // pushing at the back of queue
  }
  if (!tasks.length) clearInterval(mainLoop);
}

async function executeTask(
  cb: (...args: any[]) => Promise<any> | any,
  ...args: any[]
) {
  const timer = setTimeout(() => {
    console.error("Timeout");
    throw new Error("Timeout");
  }, 5000);

  console.log("Executing task");
  const res = await cb(...args);
  console.log("Executed Task, ", res);
  clearTimeout(timer);
  return res;
}
