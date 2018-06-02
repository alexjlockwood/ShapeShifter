declare module 'paper' {
  /**
   * The PaperScope class represents the scope associated with a Paper context. When working with PaperScript,
   * these scopes are automatically created for us, and through clever scoping the properties and methods of
   * the active scope seem to become part of the global scope.
   * When working with normal JavaScript code, PaperScope objects need to be manually created and handled.
   * Paper classes can only be accessed through PaperScope objects. Thus in PaperScript they are global,
   * while in JavaScript, they are available on the global paper object. For JavaScript you can use
   * paperScope.install(scope) to install the Paper classes and objects on the global scope. Note that
   * when working with more than one scope, this still works for classes, but not for objects like
   * paperScope.project, since they are not updated in the injected scope if scopes are switched.
   * The global paper object is simply a reference to the currently active PaperScope.
   */
  export class PaperScope {
    /**
     * The version of Paper.js, as a string.
     */
    version: string;

    /**
     * Gives access to paper's configurable settings.
     */
    settings: {
      applyMatrix: boolean;
      handleSize: number;
      hitTolerance: number;
    };

    /**
     * The currently active project.
     */
    project: Project;

    /**
     * The list of all open projects within the current Paper.js context.
     */
    projects: Project[];

    /**
     * The reference to the active project's view.
     * Read Only.
     */
    view: View;

    /**
     * The reference to the active tool.
     */
    tool: Tool;

    /**
     * The list of available tools.
     */
    tools: Tool[];

    /**
     * Injects the paper scope into any other given scope. Can be used for examle to inject the currently
     * active PaperScope into the window's global scope, to emulate PaperScript-style globally accessible
     * Paper classes and objects
     * Please note: Using this method may override native constructors (e.g. Path, RGBColor). This may
     * cause problems when using Paper.js in conjunction with other libraries that rely on these
     * constructors. Keep the library scoped if you encounter issues caused by this.
     * @param scope -
     */
    install(scope: any): void;

    /**
     * Sets up an empty project for us. If a canvas is provided, it also creates a View for it,
     * both linked to this scope.
     * @param element - the HTML canvas element this scope should be associated with, or an ID
     * string by which to find the element.
     */
    setup(canvas: HTMLCanvasElement | string): void;

    /**
     * Activates this PaperScope, so all newly created items will be placed in its active project.
     */
    activate(): void;

    /**
     * Retrieves a PaperScope object with the given scope id.
     * @param id -
     */
    static get(id: string): PaperScope;
  }
}
