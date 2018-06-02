declare module 'paper' {
  /**
   * The version of Paper.js, as a string.
   */
  export const version: string;

  /**
   * Gives access to paper's configurable settings.
   */
  export const settings: {
    applyMatrix: boolean;
    handleSize: number;
    hitTolerance: number;
    insertItems: boolean;
  };

  /**
   * The currently active project.
   */
  export const project: Project;

  /**
   * The list of all open projects within the current Paper.js context.
   */
  export const projects: ReadonlyArray<Project>;

  /**
   * The reference to the active project's view.
   * Read Only.
   */
  export const view: View;

  /**
   * The reference to the active tool.
   */
  export const tool: Tool;

  /**
   * The list of available tools.
   */
  export const tools: ReadonlyArray<Tool>;

  /**
   * Injects the paper scope into any other given scope. Can be used for examle to inject the currently active PaperScope into the window's global scope, to emulate PaperScript-style globally accessible Paper classes and objects
   * Please note: Using this method may override native constructors (e.g. Path, RGBColor). This may cause problems when using Paper.js in conjunction with other libraries that rely on these constructors. Keep the library scoped if you encounter issues caused by this.
   * @param scope -
   */
  export function install(scope: any): void;

  /**
   * Sets up an empty project for us. If a canvas is provided, it also creates a View for it, both linked to this scope.
   * @param element - the HTML canvas element this scope should be associated with, or an ID string by which to find the element.
   */
  export function setup(canvas: HTMLCanvasElement | string): void;

  /**
   * Activates this PaperScope, so all newly created items will be placed in its active project.
   */
  export function activate(): void;
}
