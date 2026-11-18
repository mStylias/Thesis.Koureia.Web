import { Component, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { LucideFile, LucideFolder } from '@lucide/angular';
import type { DataSource } from '@ui/data-source';
import { TreeModel } from './tree-model';
import { TreeNode } from './tree-node';
import { TreeEmptyTemplate, TreeNodeTemplate } from './tree-templates';
import { Tree } from './tree';

interface FileEntry {
  kind: 'folder' | 'file';
  size?: string;
}

const node = (
  key: string,
  label: string,
  kind: FileEntry['kind'],
  children: readonly TreeNode<FileEntry>[] = [],
  expanded = false,
): TreeNode<FileEntry> => new TreeNode({ key, label, data: { kind }, children, expanded });

const fileTree = (): TreeModel<FileEntry> =>
  new TreeModel([
    node(
      'projects',
      'Projects',
      'folder',
      [
        node('website', 'Website redesign', 'folder', [
          node('brief', 'Brief.pdf', 'file'),
          node('wireframes', 'Wireframes.fig', 'file'),
        ]),
        node('mobile', 'Mobile app', 'folder', [node('roadmap', 'Roadmap.md', 'file')]),
      ],
      true,
    ),
    node('invoices', 'Invoices', 'folder', [
      node('invoice-2026', '2026.pdf', 'file'),
      node('invoice-2025', '2025.pdf', 'file'),
    ]),
    node('notes', 'Notes.txt', 'file'),
  ]);

const doc = (markdown: string, code: string) => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language: 'html' },
  },
});

@Component({
  selector: 'lib-tree-default-story',
  imports: [Tree],
  template: `
    <lib-tree
      [tree]="model"
      [(value)]="selected"
      ariaLabel="Project files"
      showGuides
      style="max-width: 30rem;"
    />
    <p style="margin-top: var(--space-3); color: var(--text-muted); font-size: var(--text-sm);">
      Selected: {{ selected().join(', ') || 'none' }}
    </p>
  `,
})
class TreeDefaultStory {
  protected readonly model = fileTree();
  protected readonly selected = signal<readonly string[]>([]);
}

@Component({
  selector: 'lib-tree-checkbox-story',
  imports: [Tree],
  template: `
    <lib-tree
      [tree]="model"
      selectionMode="checkbox"
      [(value)]="selected"
      ariaLabel="Select project files"
      showGuides
      style="max-width: 30rem;"
    />
  `,
})
class TreeCheckboxStory {
  protected readonly model = fileTree();
  protected readonly selected = signal<readonly string[]>(['brief']);
}

@Component({
  selector: 'lib-tree-template-story',
  imports: [Tree, TreeNodeTemplate, LucideFile, LucideFolder],
  template: `
    <lib-tree [tree]="model" [(value)]="selected" ariaLabel="Documents" style="max-width: 30rem;">
      <ng-template libTreeNode let-node let-selected="selected" let-level="level">
        <span style="display: inline-flex; align-items: center; gap: var(--space-2); width: 100%;">
          @if (node.data().kind === 'folder') {
            <svg lucideFolder style="width: var(--icon-size-sm); color: var(--accent-text);" />
          } @else {
            <svg lucideFile style="width: var(--icon-size-sm); color: var(--text-muted);" />
          }
          <span>{{ node.label() }}</span>
          <small style="margin-inline-start: auto; color: var(--text-muted);">
            level {{ level }}{{ selected ? ' • selected' : '' }}
          </small>
        </span>
      </ng-template>
    </lib-tree>
  `,
})
class TreeTemplateStory {
  protected readonly model = fileTree();
  protected readonly selected = signal<readonly string[]>([]);
}

@Component({
  selector: 'lib-tree-states-story',
  imports: [Tree],
  template: `
    <div
      style="display: grid; gap: var(--space-6); grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));"
    >
      <section>
        <h3 style="margin: 0 0 var(--space-2);">Readonly status</h3>
        <lib-tree
          [tree]="readonlyModel"
          selectionMode="checkbox"
          [value]="readonlyValue"
          readonly
          ariaLabel="Readonly permissions"
        />
      </section>
      <section>
        <h3 style="margin: 0 0 var(--space-2);">Disabled</h3>
        <lib-tree [tree]="disabledModel" disabled ariaLabel="Unavailable files" />
      </section>
    </div>
  `,
})
class TreeStatesStory {
  protected readonly readonlyModel = fileTree();
  protected readonly disabledModel = fileTree();
  protected readonly readonlyValue = ['projects', 'website', 'brief', 'wireframes'];
}

function deepTree(): TreeModel<FileEntry> {
  let child = node('level-8', 'Level 8', 'file');
  for (let level = 7; level >= 1; level -= 1) {
    child = node(`level-${level}`, `Level ${level}`, 'folder', [child], true);
  }
  return new TreeModel([child]);
}

@Component({
  selector: 'lib-tree-deep-story',
  imports: [Tree],
  template: `<lib-tree
    [tree]="model"
    ariaLabel="Deep hierarchy"
    showGuides
    style="max-width: 30rem;"
  />`,
})
class TreeDeepStory {
  protected readonly model = deepTree();
}

@Component({
  selector: 'lib-tree-empty-story',
  imports: [Tree, TreeEmptyTemplate],
  template: `
    <lib-tree [tree]="model" ariaLabel="Search results" style="max-width: 30rem;">
      <ng-template libTreeEmpty>
        <div style="padding: var(--space-4); text-align: center;">
          No matching files. Try a broader search.
        </div>
      </ng-template>
    </lib-tree>
  `,
})
class TreeEmptyStory {
  protected readonly model = new TreeModel<FileEntry>();
}

@Component({
  selector: 'lib-tree-large-story',
  imports: [Tree],
  template: `
    <div style="max-width: 32rem; max-height: 32rem; overflow: auto;">
      <lib-tree
        [tree]="model"
        selectionMode="multiple"
        [(value)]="selected"
        ariaLabel="500 files"
      />
    </div>
  `,
})
class TreeLargeStory {
  protected readonly model = new TreeModel<FileEntry>(
    Array.from({ length: 500 }, (_unused, index) =>
      node(`file-${index}`, `File ${index + 1}`, 'file'),
    ),
  );
  protected readonly selected = signal<readonly string[]>([]);
}

interface Region {
  readonly id: number;
  readonly name: string;
  readonly parentId: number | null;
  readonly branch: boolean;
}

const REGIONS: readonly Region[] = [
  { id: 1, name: 'Cyprus', parentId: null, branch: true },
  { id: 2, name: 'Greece', parentId: null, branch: true },
  { id: 10, name: 'Limassol', parentId: 1, branch: true },
  { id: 11, name: 'Nicosia', parentId: 1, branch: true },
  { id: 12, name: 'Larnaca', parentId: 1, branch: false },
  { id: 20, name: 'Athens', parentId: 2, branch: true },
  { id: 21, name: 'Thessaloniki', parentId: 2, branch: false },
  { id: 100, name: 'Old Port', parentId: 10, branch: false },
  { id: 101, name: 'Molos', parentId: 10, branch: false },
  { id: 102, name: 'Germasogeia', parentId: 10, branch: false },
  { id: 110, name: 'Eleftheria Square', parentId: 11, branch: false },
  { id: 111, name: 'Engomi', parentId: 11, branch: false },
  { id: 200, name: 'Kolonaki', parentId: 20, branch: false },
  { id: 201, name: 'Plaka', parentId: 20, branch: false },
];

const regionName = (region: Region): string => region.name;
const regionIsBranch = (region: Region): boolean => region.branch;

/**
 * Stands in for an OData endpoint: it answers `loadChildren` with one level and
 * `byKeys` with the rows a persisted value names, after a delay, and honours the
 * abort signal the control sends when a load is superseded.
 */
function createRegionSource(latency = 400): DataSource<Region> {
  const after = <TValue>(value: TValue, signal?: AbortSignal): Promise<TValue> =>
    new Promise<TValue>((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve(value);
      }, latency);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        },
        { once: true },
      );
    });

  return {
    load: ({ signal }) => after({ rows: REGIONS }, signal),
    loadChildren: (parent, request) =>
      after(
        { rows: REGIONS.filter((region) => (region.parentId ?? null) === parent) },
        request?.signal,
      ),
    byKeys: (keys, signal) =>
      after(
        REGIONS.filter((region) => keys.includes(region.id)),
        signal,
      ),
  };
}

@Component({
  selector: 'lib-tree-remote-story',
  imports: [Tree],
  template: `
    <lib-tree
      [source]="regions"
      key="id"
      parentKey="parentId"
      [displayWith]="displayWith"
      [hasChildren]="hasChildren"
      [(value)]="selected"
      ariaLabel="Regions"
      showGuides
      style="max-width: 30rem;"
    />
    <p style="margin-top: var(--space-3); color: var(--text-muted); font-size: var(--text-sm);">
      Selected key: {{ selected().join(', ') || 'none' }}. The form started at 100, so the control
      resolved it and opened the levels that hold it.
    </p>
  `,
})
class TreeRemoteStory {
  protected readonly regions = createRegionSource();
  protected readonly selected = signal<readonly number[]>([100]);
  protected readonly displayWith = regionName;
  protected readonly hasChildren = regionIsBranch;
}

@Component({
  selector: 'lib-tree-flat-story',
  imports: [Tree],
  template: `
    <lib-tree
      [source]="regions"
      key="id"
      parentKey="parentId"
      [displayWith]="displayWith"
      selectionMode="checkbox"
      [(value)]="selected"
      ariaLabel="Regions"
      showGuides
      style="max-width: 30rem;"
    />
  `,
})
class TreeFlatStory {
  protected readonly regions = REGIONS;
  protected readonly selected = signal<readonly number[]>([]);
  protected readonly displayWith = regionName;
}

const meta: Meta<TreeDefaultStory> = {
  title: 'Layout & Navigation/Tree',
  component: TreeDefaultStory,
  decorators: [
    applicationConfig({
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
    }),
    moduleMetadata({
      imports: [
        TreeCheckboxStory,
        TreeTemplateStory,
        TreeStatesStory,
        TreeDeepStory,
        TreeEmptyStory,
        TreeLargeStory,
        TreeRemoteStory,
        TreeFlatStory,
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<TreeDefaultStory>;

export const Default: Story = {
  parameters: doc(
    'Single selection, row-click expansion, roving focus, typeahead, and optional guide lines.',
    `<lib-tree [tree]="files" [(value)]="selectedKeys" ariaLabel="Project files" showGuides />`,
  ),
};

export const Checkbox: Story = {
  render: () => ({ template: '<lib-tree-checkbox-story />' }),
  parameters: doc(
    'Checkbox mode cascades through enabled/selectable descendants and derives partial ancestor state.',
    `<lib-tree [tree]="files" selectionMode="checkbox" [(value)]="selectedKeys" ariaLabel="Select project files" />`,
  ),
};

export const CustomTemplate: Story = {
  render: () => ({ template: '<lib-tree-template-story />' }),
  parameters: doc(
    '`libTreeNode` receives the node plus selected, partial, expanded, active, level, disabled, and readonly state.',
    `<lib-tree [tree]="files" [(value)]="selectedKeys" ariaLabel="Documents">
  <ng-template libTreeNode let-node let-selected="selected" let-level="level">
    <svg lucideFile></svg> {{ node.label() }} • level {{ level }}
  </ng-template>
</lib-tree>`,
  ),
};

export const DisabledAndReadonly: Story = {
  render: () => ({ template: '<lib-tree-states-story />' }),
  parameters: doc(
    'Disabled blocks every interaction. Readonly retains focus, navigation, and expansion, and defaults to an unmistakably non-editable three-state status indicator.',
    `<lib-tree [tree]="permissions" selectionMode="checkbox" [value]="selectedKeys" readonly />
<lib-tree [tree]="files" disabled />`,
  ),
};

export const DeepHierarchy: Story = {
  render: () => ({ template: '<lib-tree-deep-story />' }),
  parameters: doc(
    'Nested `ngTreeItemGroup` directives derive the correct ARIA level at any depth.',
    `<lib-tree [tree]="deepModel" showGuides ariaLabel="Deep hierarchy" />`,
  ),
};

export const Empty: Story = {
  render: () => ({ template: '<lib-tree-empty-story />' }),
  parameters: doc(
    'An empty model renders no `role="tree"`; project `libTreeEmpty` or use the translated default.',
    `<lib-tree [tree]="results" ariaLabel="Search results">
  <ng-template libTreeEmpty>No matching files.</ng-template>
</lib-tree>`,
  ),
};

export const RemoteSource: Story = {
  render: () => ({ template: '<lib-tree-remote-story />' }),
  parameters: doc(
    'Bind `source` instead of `tree` to read from a `DataSource`. A source that implements ' +
      '`loadChildren` is read one level at a time: the row shows a spinner, waits for its ' +
      'children, and only then expands, and an empty level turns the row into a leaf. The ' +
      'persisted key 100 is resolved through `byKeys`, its ancestors are walked through ' +
      '`parentKey`, and every level between the root and the selection is loaded, so a form ' +
      'value is visible without loading the whole hierarchy.',
    `<lib-tree
  [source]="regionSource"
  key="id"
  parentKey="parentId"
  [displayWith]="regionName"
  [hasChildren]="regionIsBranch"
  [(value)]="selectedKeys"
  ariaLabel="Regions" />`,
  ),
};

export const FlatSource: Story = {
  render: () => ({ template: '<lib-tree-flat-story />' }),
  parameters: doc(
    'A plain array, and a source with only `load`, are read once and nested through ' +
      '`parentKey`. Nothing is fetched on expansion, an orphan stays a root rather than ' +
      'disappearing, and checkbox cascading works over the materialized tree exactly as it ' +
      'does over a hand-built model.',
    `<lib-tree
  [source]="regions"
  key="id"
  parentKey="parentId"
  [displayWith]="regionName"
  selectionMode="checkbox"
  [(value)]="selectedKeys"
  ariaLabel="Regions" />`,
  ),
};

export const Large: Story = {
  render: () => ({ template: '<lib-tree-large-story />' }),
  parameters: doc(
    'A 500-row model demonstrates stable key tracking and additive multiple selection. Virtualization is intentionally deferred.',
    `<lib-tree [tree]="largeModel" selectionMode="multiple" [(value)]="selectedKeys" ariaLabel="500 files" />`,
  ),
};
