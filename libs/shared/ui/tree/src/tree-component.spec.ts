import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { TreeModel } from './tree-model';
import { TreeNode } from './tree-node';
import { TreeEmptyTemplate, TreeNodeTemplate } from './tree-templates';
import { Tree } from './tree';
import type {
  TreeNodeContextMenuEvent,
  TreeNodeEvent,
  TreeReadonlyIndicator,
  TreeSelectionMode,
} from './tree.types';

interface ItemData {
  kind: 'folder' | 'file';
}

function createModel(): TreeModel<ItemData> {
  return new TreeModel<ItemData>([
    new TreeNode<ItemData>({
      key: 'projects',
      data: { kind: 'folder' },
      label: 'Projects',
      expanded: true,
      children: [
        new TreeNode<ItemData>({ key: 'alpha', data: { kind: 'file' }, label: 'Alpha' }),
        new TreeNode<ItemData>({
          key: 'locked',
          data: { kind: 'file' },
          label: 'Locked',
          disabled: true,
        }),
        new TreeNode<ItemData>({
          key: 'archive',
          data: { kind: 'folder' },
          label: 'Archive',
          expanded: true,
          children: [
            new TreeNode<ItemData>({ key: 'beta', data: { kind: 'file' }, label: 'Beta' }),
          ],
        }),
      ],
    }),
    new TreeNode<ItemData>({ key: 'notes', data: { kind: 'file' }, label: 'Notes' }),
  ]);
}

@Component({
  imports: [Tree, TreeNodeTemplate, TreeEmptyTemplate],
  template: `
    <lib-tree
      [tree]="model()"
      [(value)]="value"
      [selectionMode]="selectionMode()"
      [readonly]="readonly()"
      [readonlyIndicator]="readonlyIndicator()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      [required]="required()"
      [showGuides]="showGuides()"
      [ariaDescribedby]="ariaDescribedby()"
      [emptyMessage]="emptyMessage()"
      ariaLabel="Files"
      (touch)="touchCount = touchCount + 1"
      (nodeActivated)="activated = $event"
      (nodeExpanded)="expanded = $event"
      (nodeCollapsed)="collapsed = $event"
      (nodeContextMenu)="contextMenu = $event"
    >
      @if (customNode()) {
        <ng-template
          libTreeNode
          let-node
          let-selected="selected"
          let-partial="partiallySelected"
          let-level="level"
        >
          <span class="custom-node">
            {{ node.data().kind }}:{{ node.label() }}:{{ selected }}:{{ partial }}:{{ level }}
          </span>
        </ng-template>
      }
      @if (customEmpty()) {
        <ng-template libTreeEmpty><strong class="custom-empty">Nothing here</strong></ng-template>
      }
    </lib-tree>
  `,
})
class TreeHost {
  readonly component = viewChild.required<Tree<ItemData>>(Tree);
  readonly model = signal(createModel());
  readonly value = signal<readonly string[]>([]);
  readonly selectionMode = signal<TreeSelectionMode>('single');
  readonly readonly = signal(false);
  readonly readonlyIndicator = signal<TreeReadonlyIndicator>('status');
  readonly disabled = signal(false);
  readonly invalid = signal(false);
  readonly required = signal(false);
  readonly showGuides = signal(false);
  readonly ariaDescribedby = signal('');
  readonly emptyMessage = signal('');
  readonly customNode = signal(false);
  readonly customEmpty = signal(false);
  touchCount = 0;
  activated?: TreeNodeEvent<ItemData>;
  expanded?: TreeNodeEvent<ItemData>;
  collapsed?: TreeNodeEvent<ItemData>;
  contextMenu?: TreeNodeContextMenuEvent<ItemData>;
}

describe('Tree component', () => {
  let fixture: ComponentFixture<TreeHost>;
  let host: TreeHost;

  function root(): HTMLElement {
    const element = fixture.nativeElement as HTMLElement;
    const tree = element.querySelector<HTMLElement>('[role="tree"]');
    if (!tree) {
      throw new Error('tree not rendered');
    }
    return tree;
  }

  function items(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="treeitem"]'));
  }

  function item(label: string): HTMLElement {
    const found = items().find((candidate) => {
      const content = candidate.querySelector<HTMLElement>(':scope > .tree-row > .tree-content');
      return (
        content !== null &&
        (content.textContent.trim() === label || content.textContent.includes(`:${label}:`))
      );
    });
    if (!found) {
      throw new Error(`tree item ${label} not rendered`);
    }
    return found;
  }

  function group(label: string): HTMLElement {
    const found = item(label).querySelector<HTMLElement>(':scope > .tree-group');
    if (!found) {
      throw new Error(`tree group ${label} not rendered`);
    }
    return found;
  }

  function row(label: string): HTMLElement {
    const found = item(label).querySelector<HTMLElement>(':scope > .tree-row');
    if (!found) {
      throw new Error(`tree row ${label} not rendered`);
    }
    return found;
  }

  function labelHit(label: string): HTMLElement {
    const found = item(label).querySelector<HTMLElement>('.tree-label-hit');
    if (!found) {
      throw new Error(`tree label ${label} not rendered`);
    }
    return found;
  }

  function indicator(label: string): HTMLElement {
    const found = item(label).querySelector<HTMLElement>('.tree-indicator');
    if (!found) {
      throw new Error(`tree indicator ${label} not rendered`);
    }
    return found;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    });
    fixture = TestBed.createComponent(TreeHost);
    host = fixture.componentInstance;
    await settle();
  });

  it('renders the Angular Aria tree contract and visible hierarchy', () => {
    expect(root().getAttribute('aria-label')).toBe('Files');
    expect(root().getAttribute('aria-multiselectable')).toBe('false');
    expect(items().map((entry) => entry.getAttribute('aria-level'))).toEqual([
      '1',
      '2',
      '2',
      '2',
      '3',
      '1',
    ]);
    expect(item('Projects').getAttribute('aria-expanded')).toBe('true');
    expect(item('Alpha').getAttribute('aria-expanded')).toBeNull();
  });

  it('selects from node text without changing expansion', async () => {
    labelHit('Projects').click();
    await settle();

    expect(host.value()).toEqual(['projects']);
    expect(host.model().get('projects')?.expanded()).toBe(true);
    expect(host.activated?.node.key).toBe('projects');
    expect(host.collapsed).toBeUndefined();
  });

  it('expands from the chevron or blank row space without changing selection', async () => {
    row('Projects').click();
    await settle();

    expect(host.value()).toEqual([]);
    expect(host.model().get('projects')?.expanded()).toBe(false);
    expect(host.collapsed?.node.key).toBe('projects');

    item('Projects').querySelector<HTMLElement>('.tree-chevron')?.click();
    await settle();

    expect(host.value()).toEqual([]);
    expect(host.model().get('projects')?.expanded()).toBe(true);
    expect(host.expanded?.node.key).toBe('projects');
  });

  it('selects a leaf from anywhere on its row', async () => {
    // The text is a fraction of the row width, and a leaf has nothing to
    // disclose, so the rest of the row must not be dead space.
    row('Alpha').click();
    await settle();

    expect(host.value()).toEqual(['alpha']);
    expect(host.activated?.node.key).toBe('alpha');
    expect(host.expanded).toBeUndefined();
    expect(host.collapsed).toBeUndefined();
  });

  it('keeps the blank space of a branch row on expansion, not selection', async () => {
    row('Archive').click();
    await settle();

    expect(host.value()).toEqual([]);
    expect(host.model().get('archive')?.expanded()).toBe(false);
  });

  it('expands an initially collapsed branch when its row is clicked', async () => {
    host.model().get('projects')?.expanded.set(false);
    await settle();

    const projects = item('Projects');
    expect(projects.getAttribute('aria-expanded')).toBe('false');
    expect(group('Projects').hasAttribute('hidden')).toBe(true);
    expect(group('Projects').hasAttribute('inert')).toBe(true);
    expect(group('Projects').getAttribute('aria-hidden')).toBe('true');
    expect(items().map((entry) => entry.textContent.trim())).toEqual(['Projects', 'Notes']);

    projects.querySelector<HTMLElement>('.tree-chevron')?.click();
    await settle();

    expect(host.model().get('projects')?.expanded()).toBe(true);
    expect(projects.getAttribute('data-motion')).toBe('pointer');
    expect(group('Projects').getAttribute('data-motion')).toBe('pointer');
    expect(group('Projects').hasAttribute('hidden')).toBe(false);
    expect(group('Projects').hasAttribute('inert')).toBe(false);
    expect(group('Projects').getAttribute('aria-hidden')).toBeNull();
    expect(item('Alpha')).toBeTruthy();
    expect(host.expanded?.node.key).toBe('projects');
  });

  it('keeps keyboard disclosure motionless', async () => {
    const projects = item('Projects');
    projects.focus();
    projects.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await settle();

    expect(host.model().get('projects')?.expanded()).toBe(false);
    expect(projects.getAttribute('data-motion')).toBeNull();
    expect(group('Projects').getAttribute('data-motion')).toBeNull();
    expect(group('Projects').hasAttribute('hidden')).toBe(true);
    expect(group('Projects').hasAttribute('inert')).toBe(true);
    expect(group('Projects').getAttribute('aria-hidden')).toBe('true');
  });

  it('toggles additive multiple selection without a modifier key', async () => {
    host.selectionMode.set('multiple');
    await settle();

    labelHit('Alpha').click();
    labelHit('Notes').click();
    await settle();

    expect(host.value()).toEqual(['alpha', 'notes']);
    expect(root().getAttribute('aria-multiselectable')).toBe('true');
  });

  it('cascades checkbox selection and exposes mixed state', async () => {
    host.selectionMode.set('checkbox');
    await settle();

    indicator('Archive').click();
    await settle();

    expect(host.value()).toEqual(['archive', 'beta']);
    expect(host.model().get('archive')?.expanded()).toBe(true);
    expect(item('Projects').getAttribute('aria-checked')).toBe('mixed');
    expect(item('Archive').getAttribute('aria-checked')).toBe('true');
    expect(item('Locked').getAttribute('aria-checked')).toBe('false');
    expect(item('Archive').getAttribute('aria-selected')).toBeNull();
  });

  it('keeps readonly rows navigable and expandable without changing selection', async () => {
    host.readonly.set(true);
    host.value.set(['projects']);
    await settle();

    const projects = item('Projects');
    expect(projects.getAttribute('aria-selected')).toBe('true');
    labelHit('Projects').click();
    await settle();

    expect(host.value()).toEqual(['projects']);
    expect(host.model().get('projects')?.expanded()).toBe(true);

    row('Projects').click();
    await settle();

    expect(host.value()).toEqual(['projects']);
    expect(host.model().get('projects')?.expanded()).toBe(false);
    expect(root().getAttribute('aria-readonly')).toBe('true');
  });

  it('uses standalone status glyphs by default for readonly checkbox trees', async () => {
    host.selectionMode.set('checkbox');
    host.readonly.set(true);
    host.value.set(['archive', 'beta']);
    await settle();

    expect(item('Archive').querySelector('.tree-status .lucide-check')).not.toBeNull();
    expect(item('Projects').querySelector('.tree-status .lucide-minus')).not.toBeNull();
    expect(item('Notes').querySelector('.tree-status svg')).toBeNull();
    expect(item('Archive').getAttribute('aria-checked')).toBe('true');

    host.readonlyIndicator.set('checkbox');
    await settle();
    expect(item('Archive').querySelector('.tree-status')).toBeNull();
    expect(item('Archive').querySelector('.tree-checkbox-mark')).not.toBeNull();
  });

  it('renders custom node content with selection and level context', async () => {
    host.customNode.set(true);
    host.value.set(['alpha']);
    await settle();

    expect(item('Alpha').querySelector('.custom-node')?.textContent.trim()).toBe(
      'file:Alpha:true:false:2',
    );
  });

  it('renders translated or projected empty states instead of a tree', async () => {
    host.model.set(new TreeModel());
    host.emptyMessage.set('No files');
    await settle();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="tree"]')).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.tree-empty')?.textContent.trim(),
    ).toBe('No files');

    host.customEmpty.set(true);
    await settle();
    expect((fixture.nativeElement as HTMLElement).querySelector('.custom-empty')?.textContent).toBe(
      'Nothing here',
    );
  });

  it('reflects form and visual state on the control', async () => {
    host.required.set(true);
    host.invalid.set(true);
    host.showGuides.set(true);
    host.ariaDescribedby.set('tree-error');
    await settle();

    const component = (fixture.nativeElement as HTMLElement).querySelector('lib-tree');
    expect(root().getAttribute('aria-required')).toBe('true');
    expect(root().getAttribute('aria-invalid')).toBe('true');
    expect(root().getAttribute('aria-describedby')).toBe('tree-error');
    expect(component?.hasAttribute('data-invalid')).toBe(true);
    expect(component?.hasAttribute('data-guides')).toBe(true);
  });

  it('emits touch only when focus leaves the composite', async () => {
    const first = item('Projects');
    const second = item('Alpha');
    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: second }));
    await settle();
    expect(host.touchCount).toBe(0);

    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();
    expect(host.touchCount).toBe(1);
  });

  it('emits context-menu events without preventing browser behavior', async () => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    item('Notes').querySelector<HTMLElement>('.tree-row')?.dispatchEvent(event);
    await settle();

    expect(host.contextMenu?.node.key).toBe('notes');
    expect(host.contextMenu?.originalEvent).toBe(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('supports public focus and expansion controls', async () => {
    host.component().collapseAll();
    await settle();
    expect(host.model().get('projects')?.expanded()).toBe(false);
    expect(host.model().get('archive')?.expanded()).toBe(false);

    host.component().expandAll();
    await settle();
    expect(host.model().get('projects')?.expanded()).toBe(true);
    expect(host.model().get('archive')?.expanded()).toBe(true);

    host.component().toggle('archive');
    host.component().focus();
    await settle();
    expect(host.model().get('archive')?.expanded()).toBe(false);
    expect(document.activeElement?.getAttribute('role')).toBe('treeitem');
  });
});

@Component({
  imports: [Tree],
  template: `<lib-tree [tree]="model" />`,
})
class EmptyTreeHost {
  readonly model = new TreeModel<ItemData>([]);
}

describe('Tree copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'tree.empty': 'customer.treeEmpty' }),
      ],
    });
    const fixture = TestBed.createComponent(EmptyTreeHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { treeEmpty: 'Nothing here yet' } }, 'en', {
      merge: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('tree/en'));
    fixture.detectChanges();

    const empty = (fixture.nativeElement as HTMLElement).querySelector('.tree-empty');
    expect(empty?.textContent.trim()).toBe('Nothing here yet');
  });
});
