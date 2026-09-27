// The parts of Skia's PathKit (pathkit-wasm) that the canvas editor uses, which the package has
// no types for. See https://skia.org/docs/user/modules/pathkit/.
declare module 'pathkit-wasm/bin/pathkit.js' {
  /** A value of one of PathKit's enums, like PathOp.UNION. */
  interface PathKitEnum {
    readonly value: number;
  }

  interface SkPath {
    /** Combines the path with another, in place. Returns null if it fails. */
    op(other: SkPath, op: PathKitEnum): SkPath | null;
    /** Turns the path into the outline of its stroke, in place. */
    stroke(options: {
      readonly width: number;
      readonly join?: PathKitEnum;
      readonly cap?: PathKitEnum;
      readonly miter_limit?: number;
    }): SkPath | null;
    /** Resolves overlaps, in place, e.g. in a stroke's outline. */
    simplify(): SkPath | null;
    /** Keeps the part of the path from start to end, as fractions of its length, in place. */
    trim(start: number, end: number, isComplement: boolean): SkPath | null;
    /** Transforms the path by a 3 by 3 matrix, in row order, in place. */
    transform(
      scaleX: number,
      skewX: number,
      transX: number,
      skewY: number,
      scaleY: number,
      transY: number,
      pers0: number,
      pers1: number,
      pers2: number,
    ): SkPath;
    setFillType(fillType: PathKitEnum): void;
    getFillTypeString(): 'nonzero' | 'evenodd';
    copy(): SkPath;
    toSVGString(): string;
    /** Frees the path's memory, which isn't garbage collected. */
    delete(): void;
  }

  interface PathKit {
    FromSVGString(pathData: string): SkPath | null;
    MakeFromOp(a: SkPath, b: SkPath, op: PathKitEnum): SkPath | null;
    readonly PathOp: {
      readonly DIFFERENCE: PathKitEnum;
      readonly INTERSECT: PathKitEnum;
      readonly UNION: PathKitEnum;
      readonly XOR: PathKitEnum;
    };
    readonly FillType: { readonly WINDING: PathKitEnum; readonly EVENODD: PathKitEnum };
    readonly StrokeJoin: {
      readonly MITER: PathKitEnum;
      readonly ROUND: PathKitEnum;
      readonly BEVEL: PathKitEnum;
    };
    readonly StrokeCap: {
      readonly BUTT: PathKitEnum;
      readonly ROUND: PathKitEnum;
      readonly SQUARE: PathKitEnum;
    };
  }

  /** Loads the WASM code, from locateFile's URL or from wasmBinary. */
  export default function PathKitInit(options?: {
    readonly locateFile?: (file: string) => string;
    readonly wasmBinary?: ArrayBuffer | Uint8Array;
  }): Promise<PathKit>;

  export type { PathKit, PathKitEnum, SkPath };
}
