import { fork, ChildProcess } from 'node:child_process';

type T_ExecuteCodeOptions = {
  timeout?: number;
};

type T_ExecuteCodeResult = {
  result: any;
};

type T_ChildMessage = 
  | { type: 'result'; data: any }
  | { type: 'error'; data: string };

type T_ParentMessage = {
  type: '__bruno__execute_code_in_fork';
  code: string;
};

/**
 * Execute JavaScript code string in a child process
 */
function executeCodeUsingFork(code: string, options: T_ExecuteCodeOptions = { timeout: 1000 }): Promise<T_ExecuteCodeResult> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = fork(__filename, [], { stdio: 'inherit' });
    let setTimeoutHandle: NodeJS.Timeout | undefined;
    let isResolved = false;

    const cleanup = () => {
      if (setTimeoutHandle) {
        clearTimeout(setTimeoutHandle);
        setTimeoutHandle = undefined;
      }
      child.removeAllListeners();
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    };

    const resolveOnce = (value: T_ExecuteCodeResult) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(value);
      }
    };

    const rejectOnce = (error: Error) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(error);
      }
    };

    // Listen for messages from child
    child.on('message', (message: T_ChildMessage) => {
      if (message.type === 'result') {
        resolveOnce({ result: message.data });
      } else if (message.type === 'error') {
        rejectOnce(new Error(`Child process execution error: ${message.data}`));
      }
    });

    // Handle exit - only reject if we haven't resolved yet
    child.on('exit', (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (!isResolved) {
        const errorMessage = signal 
          ? `Child process terminated by signal ${signal}`
          : `Child process exited with code ${exitCode}`;
        rejectOnce(new Error(errorMessage));
      }
    });

    child.on('error', (error: Error) => {
      rejectOnce(new Error(`Child process error: ${error.message}`));
    });

    // Send code to child process
    const message: T_ParentMessage = { type: '__bruno__execute_code_in_fork', code };
    child.send(message);

    // Optional timeout
    if (options.timeout && options.timeout > 0) {
      setTimeoutHandle = setTimeout(() => {
        rejectOnce(new Error(`Execution timed out after ${options.timeout}ms`));
      }, options.timeout);
    }
  });
}

// Child process message handler (when this file is forked)
if (process.send) {
  process.on('message', async (message: T_ParentMessage) => {
    if (message.type === '__bruno__execute_code_in_fork') {
      try {
        // Create a function to execute the code safely
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor as new (...args: string[]) => (...args: any[]) => Promise<any>;
        const func = new AsyncFunction('require', 'process', 'console', message.code);
        
        // Execute the code with proper context
        const result = await func(require, process, console);
        
        // Send result back to parent
        if (process.send) {
          const response: T_ChildMessage = { type: 'result', data: result };
          process.send(response);
        }
      } catch (error) {
        // Send error back to parent
        if (process.send) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const response: T_ChildMessage = { type: 'error', data: errorMessage };
          process.send(response);
        }
      }
    }
  });
}

export { executeCodeUsingFork };