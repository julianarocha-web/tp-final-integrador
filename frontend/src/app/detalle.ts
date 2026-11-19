import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, Observable, switchMap } from 'rxjs';
import { BibliotecaApi, mensajeError } from './api.service';

@Component({
  selector: 'app-detalle',
  imports: [RouterLink],
  templateUrl: './detalle.html',
})
export class Detalle {
  private readonly api = inject(BibliotecaApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly esLibro = this.route.snapshot.data['esLibro'] === true;
  readonly seccion = this.esLibro ? 'libros' : 'autores';
  readonly id = this.route.snapshot.paramMap.get('id')!;
  readonly registro = signal<{ nombre: string; autor?: string; autorId?: number } | null>(null);
  readonly cargando = signal(true);
  readonly eliminando = signal(false);
  readonly error = signal('');
  readonly aviso: string = this.router.currentNavigation()?.extras.state?.['aviso'] ?? '';

  constructor() {
    this.cargar();
  }

  cargar() {
    this.error.set('');
    this.cargando.set(true);
    const consulta: Observable<{ nombre: string; autor?: string; autorId?: number }> = this.esLibro
      ? this.api.libro(this.id).pipe(switchMap(libro => this.api.autor(String(libro.autor_id)).pipe(
          map(autor => ({ nombre: libro.titulo, autor: autor.nombre, autorId: autor.id })),
        )))
      : this.api.autor(this.id);
    consulta.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: registro => {
        this.registro.set(registro);
        this.cargando.set(false);
      },
      error: error => {
        this.error.set(mensajeError(error));
        this.cargando.set(false);
      },
    });
  }

  eliminar() {
    if (this.eliminando() || !window.confirm(`¿Eliminar ${this.esLibro ? 'el libro' : 'el autor'} «${this.registro()?.nombre}»?`)) return;
    this.eliminando.set(true);
    this.error.set('');
    const solicitud = this.esLibro ? this.api.eliminarLibro(this.id) : this.api.eliminarAutor(this.id);
    solicitud.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: resultado => {
        void this.router.navigate(['/', this.seccion], { state: { aviso: resultado.mensaje } });
      },
      error: error => {
        this.error.set(mensajeError(error));
        this.eliminando.set(false);
      },
    });
  }
}
