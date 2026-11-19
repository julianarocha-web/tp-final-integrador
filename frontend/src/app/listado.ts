import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, Observable, of, startWith, Subject, switchMap } from 'rxjs';
import { BibliotecaApi, mensajeError } from './api.service';
import { Autor, Libro } from './models';

@Component({
  selector: 'app-listado',
  imports: [FormsModule, RouterLink],
  templateUrl: './listado.html',
})
export class Listado {
  private readonly api = inject(BibliotecaApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();
  readonly esLibro = this.route.snapshot.data['esLibro'] === true;
  readonly seccion = this.esLibro ? 'libros' : 'autores';
  readonly autores = signal<Autor[]>([]);
  readonly registros = signal<(Autor | Libro)[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly errorAutores = signal('');
  readonly aviso: string = inject(Router).currentNavigation()?.extras.state?.['aviso'] ?? '';
  buscar = '';
  autorId: number | null = null;

  constructor() {
    if (this.esLibro) this.cargarAutores();

    this.recargar.pipe(
      startWith(undefined),
      switchMap(() => {
        this.cargando.set(true);
        this.error.set('');
        const consulta: Observable<(Autor | Libro)[]> = this.esLibro
          ? this.api.libros(this.buscar, this.autorId)
          : this.api.autores();
        return consulta.pipe(
          map(registros => ({ registros, error: '' })),
          catchError(error => of({ registros: [], error: mensajeError(error) })),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ registros, error }) => {
      this.registros.set(registros);
      this.error.set(error);
      this.cargando.set(false);
    });
  }

  cargarAutores() {
    this.errorAutores.set('');
    this.api.autores().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: autores => this.autores.set(autores),
      error: error => this.errorAutores.set(mensajeError(error)),
    });
  }

  filtrar() { this.recargar.next(); }

  limpiar() {
    this.buscar = '';
    this.autorId = null;
    this.filtrar();
  }

  nombre(registro: Autor | Libro) {
    return 'titulo' in registro ? registro.titulo : registro.nombre;
  }

  autor(registro: Autor | Libro) {
    if ('autor_id' in registro) {
      return this.autores().find(autor => autor.id === registro.autor_id)?.nombre ?? `Autor #${registro.autor_id}`;
    }
    return '';
  }
}
