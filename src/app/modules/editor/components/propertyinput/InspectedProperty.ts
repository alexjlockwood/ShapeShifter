import { Property } from 'app/modules/editor/model/properties';

/**
 * Shows values without saving them as undo steps, e.g. while a color or a curve is dragged (see
 * LayerTimelineService.previewLayer). Whatever shows the previews must commit or cancel them when
 * the drag ends, and also when it unmounts or loses focus, or the previewed value stays on screen
 * and the next edit's undo step saves it.
 */
export interface ValuePreview<V> {
  // Shows the value without an undo step.
  readonly preview: (value: V) => void;
  // Saves the previewed value as one undo step.
  readonly commit: () => void;
  // Shows the value from before the previews again.
  readonly cancel: () => void;
}

/**
 * Stores information about an inspected property.
 * V is the property value type (number, string, or path).
 */
export class InspectedProperty<V> {
  readonly typeName: string;

  constructor(
    // The model object being inspected (a layer, animation, or animation block).
    model: any,
    // The model object's inspected property.
    readonly property: Property<V>,
    // The model object's inspected property name.
    readonly propertyName: string,
    // The in-memory entered value map.
    private readonly enteredValueMap: Map<string, any>,
    // Stores the model's entered value for the given property name in the application store.
    private readonly setValueFn: (value: V) => void,
    // Returns the value associated with this model's property name.
    private readonly getValueFn = () => model[propertyName],
    // Provides an opportunity to edit the value before it is set.
    private readonly transformEditedValueFn = (enteredValue: V) => enteredValue,
    // Returns whether or not this property name is editable.
    readonly isEditable = () => true,
    // Previews values while they're dragged. Without it, previewing sets the value.
    private readonly valuePreview?: ValuePreview<V>,
  ) {
    this.typeName = this.property.getTypeName();
  }

  get value() {
    return this.getValueFn();
  }

  set value(value: V) {
    this.setValueFn(value);
  }

  getDisplayValue() {
    return this.property.displayValueForValue(this.value);
  }

  get editableValue() {
    const enteredValue = this.getEnteredValue();
    return enteredValue === undefined
      ? this.property.getEditableValue(this, 'value')
      : enteredValue;
  }

  set editableValue(enteredValue: V) {
    this.setEnteredValue(enteredValue);
    enteredValue = this.transformEditedValueFn(enteredValue);
    this.property.setEditableValue(this, 'value', enteredValue);
  }

  /** Whether previewValue can show a value without saving it. */
  get canPreview() {
    return !!this.valuePreview;
  }

  /**
   * Shows the value without an undo step, e.g. on every move of a drag. Call commitPreview when
   * the drag ends, or cancelPreview to go back, and one of them on unmount or blur too. Without a
   * preview, it sets the value.
   */
  previewValue(value: V) {
    this.setEnteredValue(undefined);
    if (this.valuePreview) {
      this.valuePreview.preview(value);
    } else {
      this.value = value;
    }
  }

  /** Saves the previewed value as one undo step. */
  commitPreview() {
    this.valuePreview?.commit();
  }

  /** Shows the value from before the previews again, without an undo step. */
  cancelPreview() {
    this.valuePreview?.cancel();
  }

  resolveEnteredValue() {
    this.setEnteredValue(undefined);
  }

  private getEnteredValue() {
    if (this.enteredValueMap.has(this.propertyName)) {
      return this.enteredValueMap.get(this.propertyName);
    }
    return undefined;
  }

  private setEnteredValue(value: any) {
    if (value === undefined) {
      this.enteredValueMap.delete(this.propertyName);
    } else {
      this.enteredValueMap.set(this.propertyName, value);
    }
  }
}
