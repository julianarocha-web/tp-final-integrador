import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { BibliotecaApi, mensajeError } from './api.service';
import { Autor, Libro } from './models';
import { autorObligatorio, textoObligatorio } from './validacion';

@Component({
  selector: 'app-formulario',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './formulario.html',
})
export class Formulario {
  private readonly api = inject(BibliotecaApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly esLibro = this.route.snapshot.data['esLibro'] === true;
  readonly seccion = this.esLibro ? 'libros' : 'autores';
  readonly etiqueta = this.esLibro ? 'Título' : 'Nombre';
  readonly encabezado = this.id
    ? (this.esLibro ? 'Editar libro' : 'Editar autor')
    : (this.esLibro ? 'Nuevo libro' : 'Nuevo autor');
  readonly cancelar = this.id ? ['/', this.seccion, this.id] : ['/', this.seccion];
  readonly autores = signal<Autor[]>([]);
  readonly cargando = signal(true);
  readonly listo = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly formulario = new FormGroup({
    texto: new FormControl('', { nonNullable: true, validators: textoObligatorio }),
    autor: new FormControl<number | null>(null, this.esLibro ? autorObligatorio : null),
  });

  constructor() {
    this.cargar();
  }

  cargar() {
    this.error.set('');
    this.cargando.set(true);
    const registro: Observable<Autor | Libro | null> = !this.id ? of(null)
      : this.esLibro ? this.api.libro(this.id) : this.api.autor(this.id);

    forkJoin({ registro, autores: this.esLibro ? this.api.autores() : of([]) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ registro, autores }) => {
          this.autores.set(autores);
          if (registro) {
            this.formulario.setValue('titulo' in registro
              ? { texto: registro.titulo, autor: registro.autor_id }
              : { texto: registro.nombre, autor: null });
          }
          this.listo.set(true);
          this.cargando.set(false);
        },
        error: error => {
          this.error.set(mensajeError(error));
          this.cargando.set(false);
        },
      });
  }

  guardar() {
    if (!this.listo() || this.guardando()) return;
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) return;

    this.error.set('');
    this.guardando.set(true);
    const { texto, autor } = this.formulario.getRawValue();
    let solicitud: Observable<Autor | Libro>;

    if (this.esLibro) {
      const datos = { titulo: texto.trim(), autor_id: autor! };
      solicitud = this.id ? this.api.editarLibro(this.id, datos) : this.api.crearLibro(datos);
    } else {
      const datos = { nombre: texto.trim() };
      solicitud = this.id ? this.api.editarAutor(this.id, datos) : this.api.crearAutor(datos);
    }

    solicitud.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: registro => {
        const entidad = this.esLibro ? 'Libro' : 'Autor';
        const aviso = this.id ? `${entidad} actualizado.` : `${entidad} creado.`;
        void this.router.navigate(['/', this.seccion, registro.id], { state: { aviso } });
      },
      error: error => {
        this.guardando.set(false);
        this.error.set(mensajeError(error));
      },
    });
  }
}
