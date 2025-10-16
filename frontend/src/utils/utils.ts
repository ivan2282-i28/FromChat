/**
 * @fileoverview Utility functions used throughout the application
 * @description Contains helper functions for common operations
 * @author Cursor
 * @version 1.0.0
 */

export * from "@fromchat/shared/utils";

export function id<T extends Element = HTMLElement>(id: string): T {
    return document.getElementById(id) as unknown as T
}

/**
 * Runs the specified callback after `click` or `touchstart` event is triggered.
 * 
 * @param action The action to perform after interaction
 * @returns A function to clean up the event listeners.
 */
export function doAfterInteraction<T>(action?: () => (T | Promise<T>)): Promise<T> {
    return new Promise((resolve, reject) => {
        function doAfterInteractionInner() {
            document.removeEventListener("click", doAfterInteractionInner);
            document.removeEventListener("touchstart", doAfterInteractionInner);
            try {
                const result = action?.();
                if (result instanceof Promise) {
                    result.then(resolve);
                } else {
                    resolve(result as T);
                }
            } catch (error) {
                reject(error);
            }
        }

        document.addEventListener("click", doAfterInteractionInner);
        document.addEventListener("touchstart", doAfterInteractionInner);

        setTimeout(reject, 10000);
    });
}