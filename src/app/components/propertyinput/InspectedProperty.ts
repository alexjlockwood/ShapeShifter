import { Property } from 'app/model/properties';

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
    public readonly property: Property<V>,
    // The model object's inspected property name.
    public readonly propertyName: string,
    // The in-memory entered value map.
    private readonly enteredValueMap: Map<string, any>,
    // Stores the model's entered value for the given property name in the application store.
    private readonly setValueFn: (value: V) => void,
    // Returns the value associated with this model's property name.
    private readonly getValueFn = () => model[propertyName],
    // Provides an opportunity to edit the value before it is set.
    private readonly transformEditedValueFn = (enteredValue: V) => enteredValue,
    // Returns whether or not this property name is editable.
    public readonly isEditable = () => true,
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

  resolveEnteredValue() {
    this.setEnteredValue(undefined);
  }

  private getEnteredValue() {
    if (this.enteredValueMap.has(this.propertyName)) {
      return this.enteredValueMap.get(this.propertyName);
    }
    return undefined;
  }

  private setEnteredValue(value) {
    if (value === undefined) {
      this.enteredValueMap.delete(this.propertyName);
    } else {
      this.enteredValueMap.set(this.propertyName, value);
    }
  }
}
