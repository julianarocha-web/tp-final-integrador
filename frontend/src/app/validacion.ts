import { AbstractControl } from '@angular/forms';

export function textoObligatorio(control: AbstractControl) {
  return typeof control.value === 'string' && control.value.trim() ? null : { required: true };
}

export function autorObligatorio(control: AbstractControl) {
  return Number.isInteger(control.value) && control.value > 0 ? null : { required: true };
}
