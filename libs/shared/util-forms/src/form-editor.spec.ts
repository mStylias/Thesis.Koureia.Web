import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { field, fields } from './field-spec';
import { formEditor } from './form-editor';
import type { FormFailure } from './server-errors.types';

const NAME_MAX = 8;

const roleFields = fields<{ name: string; description: string }>({
  name: field({ label: 'roles.name', required: 'roles.nameRequired', maxLength: NAME_MAX }),
  description: field({ label: 'roles.description' }),
});

function roleEditor(
  action: () => Promise<FormFailure | undefined> = () => Promise.resolve(undefined),
) {
  const model = signal({ name: '', description: '' });
  const editor = formEditor({
    model,
    fields: roleFields,
    action,
    injector: TestBed.inject(Injector),
  });
  return { model, editor };
}

describe('formEditor', () => {
  describe('the commit gate', () => {
    it('reports nothing before a commit, so an untouched editor accuses nobody', () => {
      const { editor } = roleEditor();

      expect(editor.committed()).toBe(false);
      expect(editor.form.name().errors()).toEqual([]);
      expect(editor.form().invalid()).toBe(false);
      expect(editor.form.name().invalid()).toBe(false);
    });

    it('carries the required marker before the gate opens, so aria-required is never wrong', () => {
      const { editor } = roleEditor();

      expect(editor.form.name().required()).toBe(true);
      expect(editor.form.name().maxLength?.()).toBe(NAME_MAX);
      expect(editor.form.description().required()).toBe(false);
    });

    it('refuses the write on the first commit of an invalid form', async () => {
      let calls = 0;
      const { editor } = roleEditor(() => {
        calls += 1;
        return Promise.resolve(undefined);
      });

      const written = await editor.commit();

      expect(written).toBe(false);
      expect(calls).toBe(0);
      expect(editor.form.name().errors()[0].kind).toBe('required');
      expect(editor.form.name().errors()[0].message).toBe('roles.nameRequired');
    });

    it('validates live once a commit has been refused', async () => {
      const { model, editor } = roleEditor();
      await editor.commit();

      model.set({ name: 'Manager', description: '' });
      expect(editor.form.name().errors()).toEqual([]);

      model.set({ name: '', description: '' });
      expect(editor.form.name().errors()).toHaveLength(1);
    });

    it('writes once the form is valid', async () => {
      let written = 0;
      const { model, editor } = roleEditor(() => {
        written += 1;
        return Promise.resolve(undefined);
      });
      model.set({ name: 'Manager', description: '' });

      await expect(editor.commit()).resolves.toBe(true);
      expect(written).toBe(1);
    });

    it('closes again on reset', async () => {
      const { editor } = roleEditor();
      await editor.commit();

      editor.reset({ name: '', description: '' });

      expect(editor.committed()).toBe(false);
      expect(editor.form.name().errors()).toEqual([]);
    });
  });

  describe('server errors', () => {
    const refusal = (path?: readonly string[]): FormFailure => ({
      errors: [{ code: 'NAME_TAKEN', message: 'That name is taken.', path }],
    });

    it('places a failure that names a property on that field', async () => {
      const { model, editor } = roleEditor(() => Promise.resolve(refusal(['name'])));
      model.set({ name: 'Manager', description: '' });

      await expect(editor.commit()).resolves.toBe(false);

      expect(editor.form.name().errors()[0].message).toBe('That name is taken.');
      expect(editor.generalErrors()).toEqual([]);
    });

    it('clears a placed failure when the field it blames is edited', async () => {
      const { model, editor } = roleEditor(() => Promise.resolve(refusal(['name'])));
      model.set({ name: 'Manager', description: '' });
      await editor.commit();

      model.update((value) => ({ ...value, name: 'Chief' }));

      expect(editor.form.name().errors()).toEqual([]);
    });

    it('keeps a failure with no property in the general area', async () => {
      const { model, editor } = roleEditor(() => Promise.resolve(refusal()));
      model.set({ name: 'Manager', description: '' });

      await expect(editor.commit()).resolves.toBe(false);

      expect(editor.generalErrors()).toEqual([
        { code: 'NAME_TAKEN', message: 'That name is taken.' },
      ]);
      expect(editor.form.name().errors()).toEqual([]);
    });

    it('keeps a general failure across a keystroke, which the field state would drop', async () => {
      const { model, editor } = roleEditor(() => Promise.resolve(refusal()));
      model.set({ name: 'Manager', description: '' });
      await editor.commit();

      model.update((value) => ({ ...value, description: 'Anything' }));

      expect(editor.generalErrors()).toHaveLength(1);
    });

    it('shows a failure naming a property the form does not edit rather than dropping it', async () => {
      const { model, editor } = roleEditor(() => Promise.resolve(refusal(['tenantId'])));
      model.set({ name: 'Manager', description: '' });

      await editor.commit();

      expect(editor.generalErrors()).toHaveLength(1);
    });

    it('forgets the general area on the next commit', async () => {
      let fail = true;
      const { model, editor } = roleEditor(() => Promise.resolve(fail ? refusal() : undefined));
      model.set({ name: 'Manager', description: '' });
      await editor.commit();

      fail = false;
      await expect(editor.commit()).resolves.toBe(true);

      expect(editor.generalErrors()).toEqual([]);
    });
  });

  describe('mode', () => {
    it('lands where the source says and resets when the source changes', () => {
      const roleId = signal('new');
      const model = signal({ name: '', description: '' });
      const editor = formEditor({
        model,
        fields: roleFields,
        action: () => Promise.resolve(undefined),
        resetOn: () => roleId(),
        mode: (id) => (id === 'new' ? 'create' : 'view'),
        injector: TestBed.inject(Injector),
      });

      expect(editor.mode()).toBe('create');
      expect(editor.editing()).toBe(true);

      editor.mode.set('edit');
      roleId.set('r-1');

      expect(editor.mode()).toBe('view');
      expect(editor.viewing()).toBe(true);
    });

    it('closes the gate when the source changes', async () => {
      const roleId = signal('r-1');
      const model = signal({ name: '', description: '' });
      const editor = formEditor({
        model,
        fields: roleFields,
        action: () => Promise.resolve(undefined),
        resetOn: () => roleId(),
        injector: TestBed.inject(Injector),
      });
      await editor.commit();
      expect(editor.committed()).toBe(true);

      roleId.set('r-2');

      expect(editor.committed()).toBe(false);
      expect(editor.form.name().errors()).toEqual([]);
    });
  });
});
