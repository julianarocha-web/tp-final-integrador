import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, BibliotecaApi } from './api.service';
import { appConfig } from './app.config';
import { Detalle } from './detalle';
import { Formulario } from './formulario';

describe('Biblioteca Angular', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('envía el título y el autor como parámetros de Flask', () => {
    const api = TestBed.inject(BibliotecaApi);
    api.libros('  El Aleph  ', 7).subscribe();
    const consulta = http.expectOne(request => request.url === API_URL + '/libros');
    expect(consulta.request.method).toBe('GET');
    expect(consulta.request.params.get('buscar')).toBe('El Aleph');
    expect(consulta.request.params.get('autor_id')).toBe('7');
    consulta.flush([]);
  });

  it('muestra la validación de un nombre compuesto solo por espacios', async () => {
    const harness = await RouterTestingHarness.create();
    const formulario = await harness.navigateByUrl('/autores/nuevo', Formulario);
    formulario.formulario.controls.texto.setValue('   ');
    formulario.guardar();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Ingresá un nombre.');
    http.expectNone(API_URL + '/autores');
  });

  it('exige título y autor y carga las opciones desde Flask', async () => {
    const harness = await RouterTestingHarness.create();
    const formulario = await harness.navigateByUrl('/libros/nuevo', Formulario);
    http.expectOne(API_URL + '/autores').flush([{ id: 7, nombre: 'Jorge Luis Borges' }]);
    formulario.guardar();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Ingresá un título.');
    expect(harness.routeNativeElement?.textContent).toContain('Seleccioná un autor.');
    expect(harness.routeNativeElement?.querySelector('option:last-child')?.textContent).toContain('Jorge Luis Borges');
    http.expectNone(API_URL + '/libros');
  });

  it('muestra el rechazo de Flask al eliminar un autor con libros', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const harness = await RouterTestingHarness.create();
    const detalle = await harness.navigateByUrl('/autores/7', Detalle);
    http.expectOne(API_URL + '/autores/7').flush({ id: 7, nombre: 'Jorge Luis Borges' });
    detalle.eliminar();
    http.expectOne({ method: 'DELETE', url: API_URL + '/autores/7' }).flush(
      { error: 'No se puede eliminar un autor con libros asociados.' },
      { status: 400, statusText: 'Bad Request' },
    );
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')?.textContent)
      .toContain('No se puede eliminar un autor con libros asociados.');
  });
});
