declare const brand: unique symbol;

export type Branded<T, Name extends string> = T & { readonly [brand]: Name };

export function integerInRange(
  label: string,
  value: number,
  upperBound: number,
): number {
  if (!Number.isInteger(value) || value < 0 || value >= upperBound) {
    throw new Error(
      "Invalid " +
        label +
        " " +
        value +
        "; expected integer from 0 to " +
        (upperBound - 1),
    );
  }
  return value;
}

export function nonEmptyString(label: string, value: string): string {
  if (value.length === 0)
    throw new Error("Invalid " + label + "; expected non-empty string");
  return value;
}
