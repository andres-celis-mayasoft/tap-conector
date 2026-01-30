export class StringUtils {
  /**
   * Compara dos strings ignorando espacios (inicio, medio, final) y diferencias de mayúsculas/minúsculas.
   * @returns true si los valores son equivalentes, false si son diferentes
   */
  static areEquivalent(value1: string | null | undefined, value2: string | null | undefined): boolean {
    if (value1 == null && value2 == null) return true;
    if (value1 == null || value2 == null) return false;

    const normalize = (str: string): string => {
      return str.replace(/\s+/g, '').toLowerCase();
    };

    return normalize(value1) === normalize(value2);
  }

  /**
   * Compara dos strings y retorna true si el nuevo valor es significativamente diferente.
   * Ignora espacios y diferencias de mayúsculas/minúsculas.
   */
  static hasSignificantChange(originalValue: string | null | undefined, newValue: string | null | undefined): boolean {
    return !this.areEquivalent(originalValue, newValue);
  }
}
