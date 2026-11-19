import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { BibliotecaApi, mensajeError } from './api.service';
import { textoObligatorio } from './validacion';

@Component({
  selector: 'app-chatbot',
  imports: [ReactiveFormsModule],
  templateUrl: './chatbot.html',
})
export class Chatbot {
  private readonly api = inject(BibliotecaApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly maximo = 1000;
  readonly pregunta = new FormControl('', {
    nonNullable: true,
    validators: [textoObligatorio, Validators.maxLength(this.maximo)],
  });
  readonly formulario = new FormGroup({ pregunta: this.pregunta });
  readonly mensajes = signal<{ rol: 'usuario' | 'asistente'; texto: string }[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');

  enviar() {
    if (this.cargando()) return;
    this.pregunta.markAsTouched();
    if (this.pregunta.invalid) return;

    const texto = this.pregunta.value.trim();
    this.error.set('');
    this.cargando.set(true);
    this.mensajes.update(mensajes => [...mensajes, { rol: 'usuario', texto }]);
    this.pregunta.reset();

    this.api.consultarChatbot(texto).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.cargando.set(false)),
    ).subscribe({
      next: ({ respuesta }) => {
        this.mensajes.update(mensajes => [...mensajes, { rol: 'asistente', texto: respuesta }]);
      },
      error: error => {
        this.error.set(mensajeError(error));
        if (!this.pregunta.value) this.pregunta.setValue(texto);
      },
    });
  }
}
