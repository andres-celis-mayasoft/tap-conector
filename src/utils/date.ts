import { DateTime } from "luxon";

export class DateUtils {
  static getDate() {
    return DateTime.now().setZone('America/Bogota').toFormat('yyyyMMdd-HHmmss');
  }
}
