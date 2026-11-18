// Creates a library in the workspace layout. It does not call the Nx Angular generator, because
// that generator adds Prettier back and nests the code under src/lib.
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const { generateFiles, names, offsetFromRoot } = require('@nx/devkit');
const { applyEdits, modify, parse } = require('jsonc-parser');

const KINDS = {
  ui: {
    folder: 'libs/shared/ui',
    project: 'shared-ui',
    tags: ['scope:shared', 'type:ui'],
    alias: '@ui/',
  },
  feature: {
    folder: 'libs/features',
    project: 'features',
    tags: ['scope:app', 'type:feature'],
    alias: '@features/',
  },
  'shared-feature': {
    folder: 'libs/shared/features',
    project: 'shared-features',
    tags: ['scope:shared', 'type:feature'],
    alias: '@features/',
  },
  'data-access': {
    folder: 'libs/shared/data-access',
    project: 'shared-data-access',
    tags: ['scope:shared', 'type:data-access'],
    alias: '@api/',
  },
  util: {
    folder: 'libs/shared',
    project: 'shared-util',
    tags: ['scope:shared', 'type:util'],
    alias: '@util/',
  },
};

function resolve(options) {
  const kind = KINDS[options.kind];
  if (!kind) throw new Error(`Unknown kind "${options.kind}".`);
  if (options.name.includes('/') && options.kind !== 'feature') {
    throw new Error('Only a feature library can nest its name in folders.');
  }
  const dashed = options.name.replaceAll('/', '-');
  const projectRoot =
    options.kind === 'util'
      ? `${kind.folder}/util-${options.name}`
      : `${kind.folder}/${options.name}`;
  const leaf = names(options.name.split('/').at(-1));
  const label = leaf.fileName.replaceAll('-', ' ');
  return {
    projectRoot,
    projectName: `${kind.project}-${dashed}`,
    alias: `${kind.alias}${dashed}`,
    tags: kind.tags,
    offset: offsetFromRoot(projectRoot),
    component: options.component ?? options.kind === 'ui',
    fileName: leaf.fileName,
    className: leaf.className,
    selector: `lib-${leaf.fileName}`,
    storyTitle: `${options.storyGroup ?? 'Data'}/${label.charAt(0).toUpperCase()}${label.slice(1)}`,
  };
}

/** Adds the alias after the last alias with the same prefix, so related aliases stay together. */
function registerAlias(tree, alias, projectRoot) {
  const path = 'tsconfig.base.json';
  const text = tree.read(path, 'utf-8');
  const paths = parse(text).compilerOptions?.paths;
  if (!paths) throw new Error(`${path} has no compilerOptions.paths.`);
  if (alias in paths) throw new Error(`${path} already maps "${alias}".`);
  const prefix = alias.slice(0, alias.indexOf('/') + 1);
  const keys = Object.keys(paths);
  const after = keys.findLastIndex((key) => key.startsWith(prefix));
  // jsonc-parser edits in place, so the comments in the file survive.
  const edits = modify(
    text,
    ['compilerOptions', 'paths', alias],
    [`./${projectRoot}/src/index.ts`],
    {
      getInsertionIndex: () => (after === -1 ? keys.length : after + 1),
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    },
  );
  tree.write(path, applyEdits(text, edits));
}

module.exports = async function libraryGenerator(tree, options) {
  const values = resolve(options);
  if (tree.exists(values.projectRoot)) {
    throw new Error(`${values.projectRoot} already exists.`);
  }

  const substitutions = { ...values, tmpl: '' };
  generateFiles(tree, join(__dirname, 'files', 'common'), values.projectRoot, substitutions);
  if (values.component) {
    generateFiles(tree, join(__dirname, 'files', 'component'), values.projectRoot, substitutions);
  }
  registerAlias(tree, values.alias, values.projectRoot);

  // Runs after the files reach the disk, so the generated code has the workspace format.
  return () => {
    execFileSync('pnpm', ['exec', 'oxfmt', values.projectRoot, 'tsconfig.base.json'], {
      cwd: tree.root,
      stdio: 'inherit',
      shell: true,
    });
  };
};
