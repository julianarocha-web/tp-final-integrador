import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_URL } from './api.service';
import { appConfig } from './app.config';
import { Chatbot } from './chatbot';

describe('Chatbot', () => {
  let fixture: ComponentFixture<Chatbot>;
  let http: HttpTestingController;
  const url = API_URL + '/chatbot';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
    fixture = TestBed.createComponent(Chatbot);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function enviar(texto: string) {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = texto;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('valida una pregunta vacía sin enviar HTTP', () => {
    enviar('  ');
    http.expectNone(url);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Escribí una pregunta.');
  });

  it('indica la carga, evita envíos simultáneos y muestra la respuesta', () => {
    enviar(' ¿Cuántos libros hay? ');
    const consulta = http.expectOne({ method: 'POST', url });
    expect(consulta.request.body).toEqual({ mensaje: '¿Cuántos libros hay?' });
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('respondiendo');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    enviar('Otra pregunta');
    http.expectNone(url);

    consulta.flush({ respuesta: 'Hay dos libros registrados.' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="log"]').textContent).toContain('Hay dos libros registrados.');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);
  });

  it('muestra el error de Flask y permite reintentar con la misma pregunta', () => {
    enviar('¿Qué autores hay?');
    http.expectOne(url).flush({ error: 'Gemini alcanzó un límite de uso.' }, {
      status: 429, statusText: 'Too Many Requests',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('límite de uso');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input').value).toBe('¿Qué autores hay?');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);
  });
});
